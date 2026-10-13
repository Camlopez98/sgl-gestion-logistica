import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AppBadge } from '../../components/app-badge/app-badge';
import { AppButtonComponent } from '../../components/app-button/app-button';
import { AppCard } from '../../components/app-card/app-card';

type DriverStatus = 'Activo' | 'Inactivo';

interface Driver {
  id: number;
  name: string;
  identity: string;
  phone: string;
  vehicle: string;
  status: DriverStatus;
}

@Component({
  selector: 'app-users-page',
  imports: [AppBadge, AppButtonComponent, AppCard],
  templateUrl: './users-page.html',
  styleUrls: ['./users-page.css', './users-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppUsersPage {
  protected readonly drivers = signal<Driver[]>([
    { id: 1, name: 'Carlos Méndez', identity: '18.452.930', phone: '+58 412-4029281', vehicle: 'MACK Anthem 2024 (Placa: AA93888)', status: 'Activo' },
    { id: 2, name: 'Laura Gómez', identity: '18.890.321', phone: '+58 412-9381023', vehicle: 'Freightliner Cascadia (Placa: AB291CC)', status: 'Activo' },
    { id: 3, name: 'Diego Torres', identity: '20.124.849', phone: '+58 412-8302341', vehicle: 'Kenworth T680 (Placa: AC40DD)', status: 'Inactivo' },
    { id: 4, name: 'Ana Ruiz', identity: '16.732.190', phone: '+58 412-7828910', vehicle: 'Chevrolet FVR (Placa: AD192EE)', status: 'Activo' },
    { id: 5, name: 'Pedro Silva', identity: '15.304.811', phone: '+58 412-9120482', vehicle: 'MACK Anthem 2024 (Placa: AA829FF)', status: 'Inactivo' },
    { id: 6, name: 'María Fernanda López', identity: '19.087.462', phone: '+58 412-6217304', vehicle: 'Volvo FH (Placa: AE338FF)', status: 'Activo' },
    { id: 7, name: 'Jorge Ramírez', identity: '17.451.209', phone: '+58 412-5160922', vehicle: 'Sin asignar', status: 'Activo' },
    { id: 8, name: 'Sofía Herrera', identity: '21.018.356', phone: '+58 412-3018472', vehicle: 'International LT (Placa: AF483GG)', status: 'Activo' },
    { id: 9, name: 'Andrés Castillo', identity: '14.682.531', phone: '+58 412-4609183', vehicle: 'Sin asignar', status: 'Activo' },
    { id: 10, name: 'Valentina Rojas', identity: '22.390.174', phone: '+58 412-8391026', vehicle: 'Volvo FH (Placa: AG592HH)', status: 'Activo' },
  ]);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal('Todos');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 5;
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly formName = signal('');
  protected readonly formIdentity = signal('');
  protected readonly formPhone = signal('');
  protected readonly formVehicle = signal('');
  protected readonly formError = signal('');
  protected readonly actionMessage = signal('');
  protected readonly activeCount = computed(() => this.drivers().filter((driver) => driver.status === 'Activo').length);
  protected readonly inactiveCount = computed(() => this.drivers().filter((driver) => driver.status === 'Inactivo').length);
  protected readonly metrics = computed(() => [
    { title: 'Conductores activos', value: String(this.activeCount()), detail: 'En ruta actualmente' },
    { title: 'Conductores inactivos', value: String(this.inactiveCount()), detail: 'Sin viajes asignados' },
  ]);
  protected readonly filteredDrivers = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    return this.drivers().filter((driver) => {
      const searchable = `${driver.name} ${driver.identity} ${driver.phone} ${driver.vehicle}`.toLocaleLowerCase();
      return (!query || searchable.includes(query)) && (status === 'Todos' || driver.status === status);
    });
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredDrivers().length / this.pageSize)));
  protected readonly pageNumbers = computed(() => Array.from({ length: this.pageCount() }, (_, index) => index + 1));
  protected readonly pagedDrivers = computed(() => this.filteredDrivers().slice((this.currentPage() - 1) * this.pageSize, this.currentPage() * this.pageSize));
  protected readonly firstVisible = computed(() => this.filteredDrivers().length ? (this.currentPage() - 1) * this.pageSize + 1 : 0);
  protected readonly lastVisible = computed(() => Math.min(this.currentPage() * this.pageSize, this.filteredDrivers().length));

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }

  protected changePage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.pageCount()));
  }

  protected openNewDriverForm(): void {
    this.editingId.set(null);
    this.formName.set('');
    this.formIdentity.set('');
    this.formPhone.set('');
    this.formVehicle.set('');
    this.formError.set('');
    this.showForm.set(true);
  }

  protected editDriver(driver: Driver): void {
    this.editingId.set(driver.id);
    this.formName.set(driver.name);
    this.formIdentity.set(driver.identity);
    this.formPhone.set(driver.phone);
    this.formVehicle.set(driver.vehicle);
    this.formError.set('');
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected updateFormField(field: 'name' | 'identity' | 'phone' | 'vehicle', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'name') this.formName.set(value);
    if (field === 'identity') this.formIdentity.set(value);
    if (field === 'phone') this.formPhone.set(value);
    if (field === 'vehicle') this.formVehicle.set(value);
  }

  protected saveDriver(event: Event): void {
    event.preventDefault();
    const name = this.formName().trim();
    const identity = this.formIdentity().trim();
    const phone = this.formPhone().trim();

    if (!name || !identity || !phone) {
      this.formError.set('Completa nombre, cédula y teléfono.');
      return;
    }

    const editingId = this.editingId();
    if (editingId !== null) {
      this.drivers.update((drivers) => drivers.map((driver) => driver.id === editingId
        ? { ...driver, name, identity, phone, vehicle: this.formVehicle().trim() || 'Sin asignar' }
        : driver));
      this.actionMessage.set(`Se actualizaron los datos de ${name}.`);
    } else {
      const newDriver: Driver = {
        id: Math.max(...this.drivers().map((driver) => driver.id), 0) + 1,
        name,
        identity,
        phone,
        vehicle: this.formVehicle().trim() || 'Sin asignar',
        status: 'Activo',
      };
      this.drivers.update((drivers) => [newDriver, ...drivers]);
      this.actionMessage.set(`Se agregó a ${name} a la lista local de conductores.`);
      this.currentPage.set(1);
    }

    this.searchTerm.set('');
    this.statusFilter.set('Todos');
    this.showForm.set(false);
  }

  protected deleteDriver(driver: Driver): void {
    this.drivers.update((drivers) => drivers.filter((item) => item.id !== driver.id));
    this.currentPage.set(Math.min(this.currentPage(), Math.max(1, Math.ceil(this.filteredDrivers().length / this.pageSize))));
    this.actionMessage.set(`${driver.name} se eliminó de la lista local.`);
  }
}