import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AppBadge } from '../../components/app-badge/app-badge';
import { AppButtonComponent } from '../../components/app-button/app-button';
import { AppCard } from '../../components/app-card/app-card';

interface ReviewTrip {
  id: string;
  driver: string;
  date: string;
  amount: string;
  status: 'Pendiente' | 'En revisión';
}

@Component({
  selector: 'app-dashboard-page',
  imports: [AppBadge, AppButtonComponent, AppCard],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDashboardPage {
  protected readonly metrics = [
    { title: 'Ganancias totales', value: '$12,450,000', detail: '+13% vs. mes anterior' },
    { title: 'Viajes activos', value: '8', detail: 'En ruta actualmente' },
    { title: 'Alertas de flota', value: '3', detail: 'Mantenimiento pendiente' },
  ];

  protected readonly months = [
    { name: 'Jul', amount: 50 },
    { name: 'Ago', amount: 80 },
    { name: 'Sep', amount: 85 },
    { name: 'Oct', amount: 60 },
    { name: 'Nov', amount: 115 },
    { name: 'Dic', amount: 150 },
  ];

  protected readonly trips = signal<ReviewTrip[]>([
    { id: 'VJ-0047', driver: 'Carlos Méndez', date: '12/09/2026', amount: '$100,000', status: 'Pendiente' },
    { id: 'VJ-0046', driver: 'Laura Gómez', date: '11/09/2026', amount: '$85,000', status: 'Pendiente' },
    { id: 'VJ-0045', driver: 'Diego Torres', date: '10/09/2026', amount: '$150,000', status: 'En revisión' },
    { id: 'VJ-0044', driver: 'Ana Ruiz', date: '09/09/2026', amount: '$95,000', status: 'Pendiente' },
  ]);
  protected readonly actionMessage = signal('');

  protected completeTrip(trip: ReviewTrip): void {
    this.trips.update((trips) => trips.filter((item) => item.id !== trip.id));
    this.actionMessage.set(`El viaje ${trip.id} se marcó como finalizado en esta demostración.`);
  }

  protected auditTrip(trip: ReviewTrip): void {
    this.actionMessage.set(`Auditoría abierta para ${trip.id}, conductor ${trip.driver}.`);
  }
}