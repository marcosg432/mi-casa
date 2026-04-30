(function () {
  async function initLogin() {
    await window.RouteGuards.redirectIfAuthenticated({ targetPath: 'painel.html' });

    var form = document.getElementById('login-form');
    var emailInput = document.getElementById('login-email');
    var senhaInput = document.getElementById('login-senha');
    var erro = document.getElementById('login-erro');

    if (!form || !emailInput || !senhaInput || !erro) return;

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      erro.style.display = 'none';
      erro.textContent = '';

      var email = String(emailInput.value || '').trim();
      var senha = String(senhaInput.value || '');

      try {
        await window.Auth.signInAsAdmin(email, senha);
        window.location.href = 'painel.html';
      } catch (err) {
        erro.textContent = window.Auth.formatAuthError(err);
        erro.style.display = 'block';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogin);
  } else {
    initLogin();
  }
})();
