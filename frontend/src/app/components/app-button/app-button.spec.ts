import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppButtonComponent } from './app-button';

describe('AppButton', () => {
  let component: AppButtonComponent;
  let fixture: ComponentFixture<AppButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppButtonComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
