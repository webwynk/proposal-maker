
    const API_URL = '';
    let selectedRole = 'client';

    function setRole(role) {
      selectedRole = role;
      document.getElementById('tabClient').classList.toggle('active', role === 'client');
      document.getElementById('tabAdmin').classList.toggle('active', role === 'admin');

      const subtitle = document.getElementById('loginSubtitle');
      if (role === 'admin') {
        subtitle.textContent = "Sign in to agency dashboard";
      } else {
        subtitle.textContent = "Sign in to client portal";
      }

      document.getElementById('errorMessage').classList.remove('show');
    }

    function togglePassword() {
      const passwordInput = document.getElementById('password');
      const toggleBtn = document.getElementById('passwordToggle');
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>`;
      } else {
        passwordInput.type = 'password';
        toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>`;
      }
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const loginBtn = document.getElementById('loginBtn');
      const errorDiv = document.getElementById('errorMessage');

      loginBtn.disabled = true;
      loginBtn.textContent = 'Logging in...';
      errorDiv.classList.remove('show');

      try {
        const response = await fetch(API_URL + '/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed');
        }

        if (data.user.role !== selectedRole) {
          throw new Error(`Please use the ${data.user.role} login tab for this account.`);
        }

        // Store token
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Redirect based on role
        if (data.user.role === 'admin') {
          window.location.href = 'admin.html';
        } else {
          window.location.href = 'client.html';
        }

      } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.add('show');
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Log in';
      }
    });

    // Check if already logged in
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      const userData = JSON.parse(user);
      if (userData.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'client.html';
      }
    }
  