import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AppBadge } from '../../components/app-badge/app-badge';
import { AppButtonComponent } from '../../components/app-button/app-button';
import { AppCard } from '../../components/app-card/app-card';

type VehicleStatus = 'Activo' | 'En Mantenimiento';

interface Vehicle {
  plate: string;
  model: string;
  year: number;
  driver: string;
  kilometers: string;
  status: VehicleStatus;
  maintenance: string;
}

@Component({
  selector: 'app-fleet-page',
  imports: [AppBadge, AppButtonComponent, AppCard],
  templateUrl: './fleet-page.html',
  styleUrls: ['./fleet-page.css', './fleet-dialog.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFleetPage {
  protected readonly vehicles = signal<Vehicle[]>([
    { plate: 'ABC-123', model: 'Chevrolet NHR', year: 2022, driver: 'Carlos Méndez', kilometers: '45,200 km', status: 'Activo', maintenance: '15/10/2026' },
    { plate: 'DEF-456', model: 'Hino 300', year: 2021, driver: 'Laura Gómez', kilometers: '62,800 km', status: 'Activo', maintenance: '20/09/2026' },
    { plate: 'GHI-789', model: 'JAC X200', year: 2020, driver: 'Sin asignar', kilometers: '78,500 km', status: 'En Mantenimiento', maintenance: 'En taller' },
    { plate: 'JKL-012', model: 'Hyundai HD65', year: 2023, driver: 'Diego Torres', kilometers: '12,300 km', status: 'Activo', maintenance: '01/11/2026' },
    { plate: 'MNO-345', model: 'Foton Aumark', year: 2019, driver: 'Sin asignar', kilometers: '95,100 km', status: 'En Mantenimiento', maintenance: 'En taller' },
    { plate: 'PQR-678', model: 'JAC X200', year: 2022, driver: 'Ana Ruiz', kilometers: '38,700 km', status: 'Activo', maintenance: '08/11/2026' },
    { plate: 'STU-901', model: 'Chevrolet NHR', year: 2021, driver: 'Pedro Silva', kilometers: '51,400 km', status: 'Activo', maintenance: '12/11/2026' },
    { plate: 'VWX-234', model: 'Hino 300', year: 2020, driver: 'Carlos Méndez', kilometers: '83,200 km', status: 'En Mantenimiento', maintenance: 'En taller' },
    { plate: 'YZA-567', model: 'Hyundai HD65', year: 2024, driver: 'Laura Gómez', kilometers: '9,800 km', status: 'Activo', maintenance: '18/12/2026' },
    { plate: 'BCD-890', model: 'Foton Aumark', year: 2022, driver: 'Diego Torres', kilometers: '29,600 km', status: 'Activo', maintenance: '22/11/2026' },
    { plate: 'EFG-123', model: 'Chevrolet NHR', year: 2023, driver: 'Ana Ruiz', kilometers: '20,100 km', status: 'Activo', maintenance: '03/12/2026' },
    { plate: 'HIJ-456', model: 'Hino 300', year: 2021, driver: 'Pedro Silva', kilometers: '67,300 km', status: 'Activo', maintenance: '10/12/2026' },
  ]);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal('Todos');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 5;
  protected readonly actionMessage = signal('');
  protected readonly showForm = signal(false);
  protected readonly formPlate = signal('');
  protected readonly formModel = signal('');
  protected readonly formYear = signal('');
  protected readonly formDriver = signal('');
  protected readonly formKilometers = signal('');
  protected readonly formMaintenance = signal('');
  protected readonly formError = signal('');
  protected readonly activeCount = computed(() => this.vehicles().filter((vehicle) => vehicle.status === 'Activo').length);
  protected readonly maintenanceCount = computed(() => this.vehicles().filter((vehicle) => vehicle.status === 'En Mantenimiento').length);
  protected readonly metrics = computed(() => [
    { title: 'Total vehículos', value: String(this.vehicles().length), detail: 'En inventario' },
    { title: 'Activos', value: String(this.activeCount()), detail: 'En ruta' },
    { title: 'En mantenimiento', value: String(this.maintenanceCount()), detail: 'En taller' },
  ]);
  protected readonly filteredVehicles = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    return this.vehicles().filter((vehicle) => {
      const searchable = `${vehicle.plate} ${vehicle.model} ${vehicle.driver}`.toLocaleLowerCase();
      return (!query || searchable.includes(query)) && (status === 'Todos' || vehicle.status === status);
    });
  });
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredVehicles().length / this.pageSize)));
  protected readonly pageNumbers = computed(() => Array.from({ length: this.pageCount() }, (_, index) => index + 1));
  protected readonly pagedVehicles = computed(() => this.filteredVehicles().slice((this.currentPage() - 1) * this.pageSize, this.currentPage() * this.pageSize));
  protected readonly firstVisible = computed(() => this.filteredVehicles().length ? (this.currentPage() - 1) * this.pageSize + 1 : 0);
  protected readonly lastVisible = computed(() => Math.min(this.currentPage() * this.pageSize, this.filteredVehicles().length));

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

  protected vehicleStatusVariant(status: VehicleStatus): 'active' | 'maintenance' {
    return status === 'Activo' ? 'active' : 'maintenance';
  }

  protected registerVehicle(): void {
    this.formPlate.set('');
    this.formModel.set('');
    this.formYear.set('');
    this.formDriver.set('');
    this.formKilometers.set('');
    this.formMaintenance.set('');
    this.formError.set('');
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected updateFormField(field: 'plate' | 'model' | 'year' | 'driver' | 'kilometers' | 'maintenance', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'plate') this.formPlate.set(value);
    if (field === 'model') this.formModel.set(value);
    if (field === 'year') this.formYear.set(value);
    if (field === 'driver') this.formDriver.set(value);
    if (field === 'kilometers') this.formKilometers.set(value);
    if (field === 'maintenance') this.formMaintenance.set(value);
  }

  protected saveVehicle(event: Event): void {
    event.preventDefault();
    const plate = this.formPlate().trim().toLocaleUpperCase();
    const model = this.formModel().trim();
    const year = Number(this.formYear());

    if (!plate || !model || !year || year < 1980 || year > 2035) {
      this.formError.set('Ingresa placa, modelo y un año válido entre 1980 y 2035.');
      return;
    }
    if (this.vehicles().some((vehicle) => vehicle.plate === plate)) {
      this.formError.set('Ya existe un vehículo registrado con esa placa.');
      return;
    }

    const vehicle: Vehicle = {
      plate,
      model,
      year,
      driver: this.formDriver().trim() || 'Sin asignar',
      kilometers: `${this.formKilometers().trim() || '0'} km`,
      status: 'Activo',
      maintenance: this.formMaintenance().trim() || 'Por programar',
    };
    this.vehicles.update((vehicles) => [...vehicles, vehicle]);
    this.currentPage.set(this.pageCount());
    this.searchTerm.set('');
    this.statusFilter.set('Todos');
    this.showForm.set(false);
    this.actionMessage.set(`Vehículo ${plate} agregado al inventario local.`);
  }
}