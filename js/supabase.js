import {
  createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';


// ==========================================
// CONFIG
// ==========================================

export function isConfigured() {

  const c =
    window.COPEAK_CONFIG ||
    {};


  return Boolean(
    c.supabaseUrl &&
    c.supabaseAnonKey &&
    !c.supabaseUrl.startsWith(
      'YOUR_'
    ) &&
    !c.supabaseAnonKey.startsWith(
      'YOUR_'
    )
  );
}


// ==========================================
// ROLE FROM PAGE
// ==========================================

function pageRole() {

  const path =
    location.pathname
      .toLowerCase();


  if (
    path.endsWith(
      '/teacher.html'
    ) ||
    path.endsWith(
      'teacher.html'
    )
  ) {

    return 'teacher';
  }


  if (
    path.endsWith(
      '/student.html'
    ) ||
    path.endsWith(
      'student.html'
    )
  ) {

    return 'student';
  }


  return null;
}


// ==========================================
// SUPABASE CLIENTS
//
// Teacher / StudentのSessionを分離する。
// 同じブラウザの複数タブでも
// Sessionが上書きされない。
// ==========================================

const clients =
  new Map();


export function getClient(
  role = null
) {

  if (!isConfigured()) {

    return null;
  }


  const clientRole =
    role ||
    pageRole() ||
    'default';


  if (
    clients.has(
      clientRole
    )
  ) {

    return clients.get(
      clientRole
    );
  }


  const storageKey =
    `copeak-classroom-${clientRole}-auth`;


  const client =
    createClient(
      window.COPEAK_CONFIG
        .supabaseUrl,

      window.COPEAK_CONFIG
        .supabaseAnonKey,

      {
        auth: {

          persistSession:
            true,

          autoRefreshToken:
            true,

          detectSessionInUrl:
            true,

          storageKey

        }
      }
    );


  clients.set(
    clientRole,
    client
  );


  return client;
}


// ==========================================
// DEMO
// Tabごとに分離
// ==========================================

export function demoRole() {

  return sessionStorage.getItem(
    'copeak_demo_role'
  );
}


export function clearDemo() {

  sessionStorage.removeItem(
    'copeak_demo_role'
  );
}


// ==========================================
// REQUIRE USER
// ==========================================

export async function requireUser(
  role
) {

  const demo =
    demoRole();


  if (demo) {

    if (
      role &&
      demo !== role
    ) {

      location.href =
        demo === 'teacher'
          ? 'teacher.html'
          : 'student.html';


      return null;
    }


    return {

      demo:
        true,

      user: {
        id:
          demo === 'teacher'
            ? 'demo-teacher'
            : 's1'
      },

      profile: {

        display_name:
          demo === 'teacher'
            ? 'Nakashi-sensei'
            : 'Yuki Tanaka',

        role:
          demo
      }
    };
  }


  /*
   * ここが重要。
   *
   * teacher.htmlならTeacher Client、
   * student.htmlならStudent Clientを使う。
   */

  const sb =
    getClient(
      role
    );


  if (!sb) {

    location.href =
      'index.html';

    return null;
  }


  const {
    data: {
      user
    }
  } =
    await sb.auth
      .getUser();


  if (!user) {

    location.href =
      'index.html';

    return null;
  }


  const {
    data: profile,
    error
  } =
    await sb
      .from(
        'profiles'
      )
      .select('*')
      .eq(
        'id',
        user.id
      )
      .single();


  if (
    error ||
    !profile
  ) {

    console.error(
      error
    );


    return {
      demo:
        false,
      user,
      profile:
        null
    };
  }


  if (
    role &&
    profile.role !== role
  ) {

    /*
     * 別RoleのSessionを
     * このページで使用しない。
     */

    location.href =
      'index.html';

    return null;
  }


  return {
    demo:
      false,

    user,

    profile
  };
}


// ==========================================
// SIGN OUT
// ==========================================

export async function signOut() {

  clearDemo();


  /*
   * 現在開いているページのRoleだけ
   * Sign outする。
   *
   * TeacherがSign outしても
   * Student Sessionは消さない。
   */

  const sb =
    getClient();


  if (sb) {

    await sb.auth
      .signOut();
  }


  location.href =
    'index.html';
}


// ==========================================
// FORMAT
// ==========================================

export function fmtDate(
  value
) {

  if (!value) {

    return '—';
  }


  return new Intl
    .DateTimeFormat(
      'ja-JP',
      {
        month:
          'short',

        day:
          'numeric',

        weekday:
          'short'
      }
    )
    .format(
      new Date(value)
    );
}


export function pct(v) {

  return (
    v === null ||
    v === undefined
  )

    ? '—'

    : `${Math.round(
        Number(v)
      )}%`;
}