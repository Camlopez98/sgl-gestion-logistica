import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AppBadge } from './components/app-badge/app-badge';
import { AppButtonComponent } from './components/app-button/app-button';
import { AppCard } from './components/app-card/app-card';
import { AppDashboardPage } from './pages/dashboard-page/dashboard-page';
import { AppFleetPage } from './pages/fleet-page/fleet-page';
import { AppHistoryPage } from './pages/history-page/history-page';
import { AppUsersPage } from './pages/users-page/users-page';

type TripStatus = 'Pendiente' | 'Completado' | 'En revisión';
type BadgeVariant = 'pending' | 'completed' | 'review';

interface Trip {
  id: string;
  driver: string;
  origin: string;
  destination: string;
  date: string;
  amount: string;
  status: TripStatus;
}

@Component({
  selector: 'app-root',
  imports: [AppBadge, AppButtonComponent, AppCard, AppDashboardPage, AppFleetPage, AppHistoryPage, AppUsersPage],
  templateUrl: './dashboard.html',
  styleUrls: ['./app.css', './app-page.css', './app-responsive.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly activePage = signal<'dashboard' | 'viajes' | 'historial' | 'flota' | 'usuarios'>('viajes');
  protected readonly pageTitle = computed(() => ({
    dashboard: 'Dashboard',
    viajes: 'Viajes',
    historial: 'Historial de Viajes',
    flota: 'Gestión de Flota',
    usuarios: 'Gestión de Conductores',
  })[this.activePage()]);
  protected readonly profileName = computed(() => this.activePage() === 'historial' ? 'Carlos Méndez' : 'Admin Ramírez');

  protected readonly summary = [
    { title: 'Total viajes', value: '156', detail: 'Acumulado' },
    { title: 'En ruta', value: '8', detail: 'Activos' },
    { title: 'Completados', value: '140', detail: 'Entregados' },
    { title: 'Pendientes', value: '8', detail: 'Por auditar' },
  ];

  protected readonly trips: Trip[] = [
    { id: 'VJ-0047', driver: 'Carlos Méndez', origin: 'Bogotá', destination: 'Medellín', date: '12/09/2026', amount: '$100,000', status: 'Pendiente' },
    { id: 'VJ-0046', driver: 'Laura Gómez', origin: 'Cali', destination: 'Barranquilla', date: '11/09/2026', amount: '$85,000', status: 'Completado' },
    { id: 'VJ-0045', driver: 'Diego Torres', origin: 'Bucaramanga', destination: 'Bogotá', date: '10/09/2026', amount: '$150,000', status: 'En revisión' },
    { id: 'VJ-0044', driver: 'Ana Ruiz', origin: 'Medellín', destination: 'Cartagena', date: '09/09/2026', amount: '$95,000', status: 'Pendiente' },
    { id: 'VJ-0043', driver: 'Pedro Silva', origin: 'Manizales', destination: 'Pereira', date: '08/09/2026', amount: '$120,000', status: 'En revisión' },
  ];

  protected readonly drivers = [...new Set(this.trips.map((trip) => trip.driver))];
  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal('Todos los estados');
  protected readonly driverFilter = signal('Todos los conductores');
  protected readonly dateFilter = signal('');
  protected readonly actionMessage = signal('');

  protected readonly filteredTrips = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    const driver = this.driverFilter();
    const date = this.dateFilter();

    return this.trips.filter((trip) => {
      const matchesQuery = !query ||
        `${trip.id} ${trip.driver} ${trip.origin} ${trip.destination}`.toLocaleLowerCase().includes(query);
      const matchesStatus = status === 'Todos los estados' || trip.status === status;
      const matchesDriver = driver === 'Todos los conductores' || trip.driver === driver;
      const matchesDate = !date || trip.date.split('/').reverse().join('-') === date;

      return matchesQuery && matchesStatus && matchesDriver && matchesDate;
    });
  });

  protected setPage(page: 'dashboard' | 'viajes' | 'historial' | 'flota' | 'usuarios'): void {
    this.activePage.set(page);
    this.actionMessage.set('');
  }

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
  }

  protected onDriverChange(event: Event): void {
    this.driverFilter.set((event.target as HTMLSelectElement).value);
  }

  protected onDateChange(event: Event): void {
    this.dateFilter.set((event.target as HTMLInputElement).value);
  }

  protected badgeVariant(status: TripStatus): BadgeVariant {
    if (status === 'Completado') return 'completed';
    if (status === 'En revisión') return 'review';
    return 'pending';
  }

  protected showDetails(trip: Trip): void {
    this.actionMessage.set(`Viaje ${trip.id}: ${trip.origin} a ${trip.destination}, conductor ${trip.driver}.`);
  }

  protected auditTrip(trip: Trip): void {
    this.actionMessage.set(`Auditoría solicitada para el viaje ${trip.id}.`);
  }
}
