import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  templateUrl: './app-card.html',
  styleUrl: './app-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppCard {
  readonly title = input.required<string>();
  readonly value = input.required<string>();
  readonly detail = input.required<string>();
}
