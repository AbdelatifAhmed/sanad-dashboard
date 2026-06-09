import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { TopbarComponent } from '../../shared/components/topbar/topbar';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayoutComponent {}
