import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppAlert } from './app-alert';

describe('AppAlert', () => {
  let component: AppAlert;
  let fixture: ComponentFixture<AppAlert>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppAlert],
    }).compileComponents();

    fixture = TestBed.createComponent(AppAlert);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
