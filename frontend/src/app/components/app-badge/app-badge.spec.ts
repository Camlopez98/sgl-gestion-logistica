import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppBadge } from './app-badge';

describe('AppBadge', () => {
  let component: AppBadge;
  let fixture: ComponentFixture<AppBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(AppBadge);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Pendiente');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
