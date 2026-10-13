import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'pending' | 'completed' | 'review' | 'active' | 'inactive' | 'maintenance';

@Component({
  selector: 'app-badge',
  templateUrl: './app-badge.html',
  styleUrl: './app-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppBadge {
  readonly label = input.required<string>();
  readonly variant = input<BadgeVariant>('pending');
}
