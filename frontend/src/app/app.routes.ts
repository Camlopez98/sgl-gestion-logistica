import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, invitadoGuard, rolGuard } from './core/auth/auth.guards';
import type { DatosRuta } from './core/auth/auth.models';
import { AuthService } from './core/auth/auth.service';
import { AppShell } from './layout/shell/shell';
import { AppDashboardPage } from './pages/dashboard-page/dashboard-page';
import { AppDriverTripsPage } from './pages/driver-trips-page/driver-trips-page';
import { AppFleetPage } from './pages/fleet-page/fleet-page';
import { AppHistoryPage } from './pages/history-page/history-page';
import { AppLoginPage } from './pages/login-page/login-page';
import { AppReportsPage } from './pages/reports-page/reports-page';
import { AppTripsPage } from './pages/trips-page/trips-page';
import { AppUsersPage } from './pages/users-page/users-page';

/**
 * Punto único de registro de pantallas internas.
 * Para agregar una pantalla: una entrada con su componente y `data` (título, roles y, si va en el menú, su texto).
 */
export const rutasInternas: Routes = [
  // Administrador
  { path: 'admin/dashboard', component: AppDashboardPage, data: { titulo: 'Dashboard', menu: 'Dashboard', roles: ['ADMINISTRADOR'] } satisfies DatosRuta },
  { path: 'admin/viajes', component: AppTripsPage, data: { titulo: 'Viajes', menu: 'Viajes', roles: ['ADMINISTRADOR'] } satisfies DatosRuta },
  { path: 'admin/flota', component: AppFleetPage, data: { titulo: 'Gestión de Flota', menu: 'Flota', roles: ['ADMINISTRADOR'], separadorAntes: true } satisfies DatosRuta },
  { path: 'admin/usuarios', component: AppUsersPage, data: { titulo: 'Gestión de Conductores', menu: 'Usuarios', roles: ['ADMINISTRADOR'] } satisfies DatosRuta },

  // Conductor
  { path: 'conductor/viajes-en-curso', component: AppDriverTripsPage, data: { titulo: 'Mis viajes en curso', menu: 'Mis viajes', roles: ['CONDUCTOR'] } satisfies DatosRuta },
  { path: 'conductor/historial', component: AppHistoryPage, data: { titulo: 'Historial de Viajes', menu: 'Historial', roles: ['CONDUCTOR'] } satisfies DatosRuta },

  // Contador
  { path: 'contador/reportes', component: AppReportsPage, data: { titulo: 'Visor de reportes', menu: 'Reportes', roles: ['CONTADOR'] } satisfies DatosRuta },
];

export const routes: Routes = [
  { path: 'login', component: AppLoginPage, canActivate: [invitadoGuard], title: 'LogiTrack | Iniciar sesión' },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    canActivateChild: [authGuard, rolGuard],
    children: [
      // La raíz lleva al módulo del rol de la sesión.
      { path: '', pathMatch: 'full', redirectTo: () => inject(AuthService).rutaInicio() },
      ...rutasInternas,
    ],
  },
  { path: '**', redirectTo: '' },
];
