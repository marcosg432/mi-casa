(function (global) {
  async function requireAuth(options) {
    var cfg = options || {};
    var loginPath = cfg.loginPath || 'login.html';
    try {
      var session = await global.Auth.getSession();
      if (!session) {
        window.location.href = loginPath;
        return null;
      }
      return session;
    } catch (err) {
      window.location.href = loginPath;
      return null;
    }
  }

  async function redirectIfAuthenticated(options) {
    var cfg = options || {};
    var targetPath = cfg.targetPath || 'painel.html';
    try {
      var session = await global.Auth.getSession();
      if (session) {
        window.location.href = targetPath;
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  global.RouteGuards = {
    requireAuth: requireAuth,
    redirectIfAuthenticated: redirectIfAuthenticated
  };
})(window);
