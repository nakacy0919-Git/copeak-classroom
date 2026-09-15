import {
  getClient,
  isConfigured,
  clearDemo
} from './supabase.js';


const $ =
  selector =>
    document.querySelector(selector);


let teacherMode =
  'login';


// ==========================================
// MESSAGE
// ==========================================

function showMessage(
  text,
  type = 'info'
) {

  const msg =
    $('#message');

  msg.className =
    `alert ${type}`;

  msg.textContent =
    text;

  msg.classList.remove(
    'hidden'
  );
}


function hideMessage() {

  $('#message')
    .classList
    .add(
      'hidden'
    );
}


// ==========================================
// STUDENT / TEACHER SWITCH
// ==========================================

function showStudent() {

  hideMessage();

  $('#roleStudent')
    .classList
    .add(
      'active'
    );

  $('#roleTeacher')
    .classList
    .remove(
      'active'
    );

  $('#studentForm')
    .classList
    .remove(
      'hidden'
    );

  $('#teacherForm')
    .classList
    .add(
      'hidden'
    );

  $('#formTitle')
    .textContent =
    'Student Login';
}


function showTeacher() {

  hideMessage();

  $('#roleTeacher')
    .classList
    .add(
      'active'
    );

  $('#roleStudent')
    .classList
    .remove(
      'active'
    );

  $('#teacherForm')
    .classList
    .remove(
      'hidden'
    );

  $('#studentForm')
    .classList
    .add(
      'hidden'
    );

  syncTeacherMode();
}


$('#roleStudent').onclick =
  showStudent;


$('#roleTeacher').onclick =
  showTeacher;


// ==========================================
// STUDENT LOGIN
// ==========================================

$('#studentForm').onsubmit =
  async event => {

    event.preventDefault();

    clearDemo();

    if (!isConfigured()) {

      showMessage(
        'Supabaseが接続されていません。',
        'error'
      );

      return;
    }


    const classCode =
      $('#studentClassCode')
        .value
        .trim()
        .toUpperCase();


    const studentNumber =
      $('#studentNumber')
        .value
        .trim();


    const pin =
      $('#studentPin')
        .value
        .trim();


    if (
      !classCode ||
      !studentNumber ||
      !pin
    ) {

      showMessage(
        'Class Code・Student No.・Join PINを入力してください。',
        'error'
      );

      return;
    }


    if (
      !/^\d{6}$/.test(pin)
    ) {

      showMessage(
        'Join PINは6桁の数字です。',
        'error'
      );

      return;
    }


    const button =
      $('#studentEnterBtn');


    button.disabled =
      true;

    button.textContent =
      'Entering...';


    const sb =
  getClient(
    'student'
  );


    try {

      // ------------------------------------
      // 学校PCで別生徒のSessionを
      // 引き継がないよう必ず一度Sign out
      // ------------------------------------

      await sb.auth.signOut();


      // ------------------------------------
      // 新しい匿名Studentを作成
      // ------------------------------------

      const {
        data: anonymousData,
        error: anonymousError
      } =
        await sb.auth
          .signInAnonymously({

            options: {

              data: {

                role:
                  'student',

                display_name:
                  'Student'

              }

            }

          });


      if (anonymousError) {

        throw anonymousError;
      }


      if (
        !anonymousData?.user
      ) {

        throw new Error(
          'Student sessionを作成できませんでした。'
        );
      }


      // ------------------------------------
      // Class Code + No. + PINを照合
      // ------------------------------------

      const {
        error: joinError
      } =
        await sb.rpc(
          'join_class_with_roster',
          {

            p_code:
              classCode,

            p_student_number:
              studentNumber,

            p_pin:
              pin

          }
        );


      if (joinError) {

        // 認証失敗した匿名Sessionは残さない
        await sb.auth.signOut();

        throw joinError;
      }


      location.href =
        'student.html';


    } catch (error) {

      console.error(
        '[Student Login]',
        error
      );


      showMessage(
        error.message ||
        String(error),
        'error'
      );


    } finally {

      button.disabled =
        false;

      button.textContent =
        'Enter Classroom';
    }
  };


// ==========================================
// TEACHER MODE
// ==========================================

function syncTeacherMode() {

  const signup =
    teacherMode ===
    'signup';


  $('#teacherNameField')
    .classList
    .toggle(
      'hidden',
      !signup
    );


  $('#teacherSubmitBtn')
    .textContent =
    signup
      ? 'Create account'
      : 'Sign in';


  $('#teacherSwitchMode')
    .textContent =
    signup
      ? 'すでにアカウントがある先生：Sign in'
      : '初めて使う先生：アカウント作成';


  $('#formTitle')
    .textContent =
    signup
      ? 'Create Teacher Account'
      : 'Teacher Login';
}


$('#teacherSwitchMode').onclick =
  () => {

    teacherMode =
      teacherMode ===
      'login'
        ? 'signup'
        : 'login';

    hideMessage();

    syncTeacherMode();
  };


// ==========================================
// TEACHER LOGIN / SIGNUP
// ==========================================

$('#teacherForm').onsubmit =
  async event => {

    event.preventDefault();

    clearDemo();


    if (!isConfigured()) {

      showMessage(
        'Supabaseが接続されていません。',
        'error'
      );

      return;
    }


    const email =
      $('#teacherEmail')
        .value
        .trim();


    const password =
      $('#teacherPassword')
        .value;


    const button =
      $('#teacherSubmitBtn');


    if (
      !email ||
      !password
    ) {

      showMessage(
        'EmailとPasswordを入力してください。',
        'error'
      );

      return;
    }


    button.disabled =
      true;


    const sb =
  getClient(
    'teacher'
  );


    try {

      if (
        teacherMode ===
        'login'
      ) {

        button.textContent =
          'Signing in...';


        await sb.auth.signOut();


        const {
          data,
          error
        } =
          await sb.auth
            .signInWithPassword({

              email,
              password

            });


        if (error) {

          throw error;
        }


        const {
          data: profile,
          error: profileError
        } =
          await sb
            .from(
              'profiles'
            )
            .select(
              'role'
            )
            .eq(
              'id',
              data.user.id
            )
            .single();


        if (profileError) {

          throw profileError;
        }


        if (
          profile.role !==
          'teacher'
        ) {

          await sb.auth.signOut();

          throw new Error(
            'このアカウントはTeacherアカウントではありません。'
          );
        }


        location.href =
          'teacher.html';


      } else {

        const displayName =
          $('#teacherDisplayName')
            .value
            .trim();


        if (!displayName) {

          throw new Error(
            '先生の名前を入力してください。'
          );
        }


        button.textContent =
          'Creating...';


        await sb.auth.signOut();


        const {
          data,
          error
        } =
          await sb.auth
            .signUp({

              email,
              password,

              options: {

                data: {

                  display_name:
                    displayName,

                  role:
                    'teacher'

                }

              }

            });


        if (error) {

          throw error;
        }


        if (data.session) {

          location.href =
            'teacher.html';

        } else {

          showMessage(
            'Teacherアカウントを作成しました。確認メールが有効な場合は、メール確認後にSign inしてください。',
            'ok'
          );
        }
      }


    } catch (error) {

      console.error(
        '[Teacher Auth]',
        error
      );


      showMessage(
        error.message ||
        String(error),
        'error'
      );


    } finally {

      button.disabled =
        false;

      syncTeacherMode();
    }
  };


// ==========================================
// INITIAL
// ==========================================

showStudent();