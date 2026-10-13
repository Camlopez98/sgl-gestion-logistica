import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-button',
  templateUrl: './app-button.html',
  styleUrl: './app-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppButtonComponent {
  readonly label = input('Botón');
  readonly variant = input<'primary' | 'danger' | 'success' | 'quiet'>('primary');
  readonly btnClick = output<void>();
}