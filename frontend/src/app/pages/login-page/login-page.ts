import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService, type MotivoCierre } from '../../core/auth/auth.service';
import { codigoDeError, mensajeDeError } from '../../core/http/mensaje-error';

/** Formato de correo: texto@dominio.extensión (el mismo criterio que valida el servidor). */
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AVISO_POR_MOTIVO: Record<MotivoCierre, string> = {
  cerrada: 'Cerró sesión correctamente.',
  expirada: 'Su sesión expiró por inactividad. Inicie sesión nuevamente.',
  inactiva: 'Su cuenta está inactiva. Comuníquese con el administrador.',
  invalida: 'Su sesión ya no es válida. Inicie sesión nuevamente.',
};

const CODIGOS_DE_CREDENCIALES = ['CREDENCIALES_INVALIDAS', 'CUENTA_INACTIVA', 'DATOS_INVALIDOS'];

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(PATRON_EMAIL)]],
    password: ['', Validators.required],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly puedeReintentar = signal(false);

  /** Aviso cuando se llega desde un cierre de sesión (?motivo=expirada, inactiva...). */
  protected readonly aviso = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((parametros) => AVISO_POR_MOTIVO[parametros.get('motivo') as MotivoCierre] ?? ''),
    ),
    { initialValue: '' },
  );

  protected campoInvalido(campo: 'email' | 'password'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  protected iniciarSesion(): void {
    if (this.enviando()) return;

    // HU-18, escenario 6: con campos inválidos no se envía la solicitud.
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.elemento.nativeElement.querySelector<HTMLInputElement>('input.ng-invalid')?.focus();
      return;
    }

    const { email, password } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set('');

    this.auth.login(email.trim(), password).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.auth.rutaInicio(), { replaceUrl: true });
      },
      error: (error: unknown) => {
        const codigo = codigoDeError(error);
        const esDeCredenciales = codigo !== null && CODIGOS_DE_CREDENCIALES.includes(codigo);

        this.error.set(mensajeDeError(error));
        this.puedeReintentar.set(!esDeCredenciales);
        if (codigo === 'CREDENCIALES_INVALIDAS') {
          this.formulario.controls.password.reset();
        }
        this.enviando.set(false);
      },
    });
  }
}
