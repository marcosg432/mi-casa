(function (global) {
  var ADMIN_EMAIL = 'sitiorecantodapazgo@gmail.com';
  var ADMIN_PASSWORD = 'edmundositio';

  function client() {
    if (!global.SupabaseClient) throw new Error('SupabaseClient indisponivel.');
    return global.SupabaseClient;
  }

  function errMsg(err) {
    return String(err && err.message ? err.message : '');
  }

  function formatAuthError(err) {
    var msg = errMsg(err).toLowerCase();
    if (msg.indexOf('only request this after') !== -1) {
      return 'Muitas tentativas seguidas. Aguarde alguns segundos e tente novamente.';
    }
    if (msg.indexOf('invalid login credentials') !== -1) {
      return 'E-mail ou senha incorretos.';
    }
    if (msg.indexOf('admin_user_exists_with_other_password') !== -1) {
      return 'Esse e-mail já existe no Supabase com outra senha. Atualize a senha desse usuário para "edmundositio" no painel do Supabase (Auth > Users).';
    }
    return errMsg(err) || 'Falha na autenticacao.';
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function signInWithRetry(email, password, retries, waitMs) {
    var attempts = typeof retries === 'number' ? retries : 2;
    var interval = typeof waitMs === 'number' ? waitMs : 500;
    var lastErr = null;
    for (var i = 0; i <= attempts; i++) {
      try {
        return await signIn(email, password);
      } catch (err) {
        lastErr = err;
        if (i === attempts) break;
        await delay(interval);
      }
    }
    throw lastErr;
  }

  async function getSession() {
    var res = await client().auth.getSession();
    if (res.error) throw res.error;
    return res.data.session || null;
  }

  async function getUser() {
    var res = await client().auth.getUser();
    if (res.error) throw res.error;
    return res.data.user || null;
  }

  async function signOut() {
    var res = await client().auth.signOut();
    if (res.error) throw res.error;
    return true;
  }

  async function signIn(email, password) {
    var res = await client().auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || '')
    });
    if (res.error) throw res.error;
    return res.data;
  }

  async function signUp(email, password) {
    var res = await client().auth.signUp({
      email: String(email || '').trim(),
      password: String(password || '')
    });
    if (res.error) throw res.error;
    return res.data;
  }

  async function signInAsAdmin(email, password) {
    var e = String(email || '').trim().toLowerCase();
    var p = String(password || '');
    if (e !== ADMIN_EMAIL.toLowerCase() || p !== ADMIN_PASSWORD) {
      var denied = new Error('Credenciais invalidas.');
      denied.code = 'admin_denied';
      throw denied;
    }

    try {
      var ok = await signInWithRetry(e, p, 1, 400);
      if (ok && ok.session) return ok;
    } catch (errSignIn) {
      var msg = errMsg(errSignIn).toLowerCase();
      var maybeMissingUser =
        msg.indexOf('invalid login credentials') !== -1 ||
        msg.indexOf('user not found') !== -1;

      if (!maybeMissingUser) throw errSignIn;

      try {
        var created = await signUp(e, p);
        if (created && created.session) return created;
      } catch (errSignUp) {
        var up = errMsg(errSignUp).toLowerCase();
        if (up.indexOf('already registered') !== -1 || up.indexOf('already been registered') !== -1) {
          try {
            return await signInWithRetry(e, p, 2, 650);
          } catch (errExisting) {
            var existing = new Error('admin_user_exists_with_other_password');
            throw existing;
          }
        }
        throw errSignUp;
      }

      return signInWithRetry(e, p, 2, 650);
    }

    var fallback = new Error('Nao foi possivel concluir o login.');
    fallback.code = 'admin_login_incomplete';
    throw fallback;
  }

  global.Auth = {
    getSession: getSession,
    getUser: getUser,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    signInAsAdmin: signInAsAdmin,
    formatAuthError: formatAuthError
  };
})(window);
