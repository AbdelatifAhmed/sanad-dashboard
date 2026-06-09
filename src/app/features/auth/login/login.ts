import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Signalled states for reactive template updates
  readonly hidePassword = signal<boolean>(true);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string>('');

  // Define reactive form
  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [false]
  });

  togglePassword(): void {
    this.hidePassword.update((val) => !val);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (res) => {
        if (res.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(res.message || 'Authentication failed.');
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error(err);
        const msg = err?.message || 'An error occurred during sign in. Please try again.';
        this.errorMessage.set(msg);
        this.isLoading.set(false);
      }
    });
  }
}
