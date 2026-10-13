import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AppBadge } from '../../components/app-badge/app-badge';
import { AppCard } from '../../components/app-card/app-card';

interface HistoryTrip {
  date: string;
  origin: string;
  destination: string;
  plate: string;
  expense: string;
  status: 'Entregado' | 'En revisión';
}

@Component({
  selector: 'app-history-page',
  imports: [AppBadge, AppCard],
  templateUrl: './history-page.html',
  styleUrl: './history-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHistoryPage {
  protected readonly summaries = [
    { title: 'Total viajes', value: '47', detail: 'Registrados' },
    { title: 'Km recorridos', value: '12,350', detail: 'Distancia total' },
    { title: 'Gasto total', value: '$2,450,000', detail: 'En viajes' },
  ];

  private readonly records: HistoryTrip[] = [
    { date: '12/09/2026', origin: 'Bogotá', destination: 'Medellín', plate: 'ABC-123', expense: '$100,000', status: 'Entregado' },
    { date: '10/09/2026', origin: 'Cali', destination: 'Bogotá', plate: 'ABC-123', expense: '$85,000', status: 'Entregado' },
    { date: '06/09/2026', origin: 'Medellín', destination: 'Barranquilla', plate: 'ABC-123', expense: '$150,000', status: 'Entregado' },
    { date: '05/09/2026', origin: 'Bogotá', destination: 'Bucaramanga', plate: 'ABC-123', expense: '$95,000', status: 'En revisión' },
    { date: '05/09/2026', origin: 'Bogotá', destination: 'Bucaramanga', plate: 'ABC-123', expense: '$95,000', status: 'En revisión' },
    { date: '02/09/2026', origin: 'Cartagena', destination: 'Bogotá', plate: 'ABC-123', expense: '$120,000', status: 'Entregado' },
  ];

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal('Todos');
  protected readonly dateFilter = signal('');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 5;

  protected readonly filteredRecords = computed(() => {
    const query = this.searchTerm().trim().toLocaleLowerCase();
    const status = this.statusFilter();
    const date = this.dateFilter();

    return this.records.filter((record) => {
      const searchable = `${record.origin} ${record.destination} ${record.plate}`.toLocaleLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesStatus = status === 'Todos' || record.status === status;
      const matchesDate = !date || record.date.split('/').reverse().join('-') === date;
      return matchesSearch && matchesStatus && matchesDate;
    });
  });

  protected readonly pagedRecords = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredRecords().slice(start, start + this.pageSize);
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filteredRecords().length / this.pageSize)));
  protected readonly firstVisible = computed(() => this.filteredRecords().length ? (this.currentPage() - 1) * this.pageSize + 1 : 0);
  protected readonly lastVisible = computed(() => Math.min(this.currentPage() * this.pageSize, this.filteredRecords().length));

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  protected onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.currentPage.set(1);
  }

  protected onDateChange(event: Event): void {
    this.dateFilter.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  protected changePage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.pageCount()));
  }
}