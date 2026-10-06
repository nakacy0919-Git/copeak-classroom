import {
  getClient,
  isConfigured,
  clearDemo,
  getStudentRememberLogin,
  setStudentRememberLogin,
  clearStudentAuthStorage
} from './supabase.js';


const $ =
  selector =>
    document.querySelector(selector);


let teacherMode =
  'login';

let rememberedStudent =
  null;

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

  $('#teacherForm')
    .classList
    .add(
      'hidden'
    );


  const rememberedPanel =
    $('#rememberedStudentPanel');


  if (rememberedStudent) {

    $('#studentForm')
      .classList
      .add(
        'hidden'
      );

    rememberedPanel
      ?.classList
      .remove(
        'hidden'
      );

  } else {

    rememberedPanel
      ?.classList
      .add(
        'hidden'
      );

    $('#studentForm')
      .classList
      .remove(
        'hidden'
      );
  }


  $('#formTitle')
    .textContent =
    rememberedStudent
      ? 'Welcome Back'
      : 'Student Login';
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

    $('#rememberedStudentPanel')
  ?.classList
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

        const rememberLogin =
      $('#studentRememberLogin')
        ?.checked ??
      true;

    setStudentRememberLogin(
      rememberLogin
    );

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


  $('#teacherSignupFields')
    ?.classList
    .toggle(
      'hidden',
      !signup
    );


  const password =
    $('#teacherPassword');


  if (password) {

    password.autocomplete =
      signup
        ? 'new-password'
        : 'current-password';
  }


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
              'role,teacher_status'
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


        if (
          profile.teacher_status ===
          'approved'
        ) {

          location.href =
            'teacher.html';

        } else {

          location.href =
            'teacher-pending.html';
        }


      } else {

        const displayName =
          $('#teacherDisplayName')
            .value
            .trim();


        const schoolName =
          $('#teacherSchoolName')
            ?.value
            .trim() ||
          '';


        const prefecture =
          $('#teacherPrefecture')
            ?.value
            .trim() ||
          '';


        const schoolType =
          $('#teacherSchoolType')
            ?.value
            .trim() ||
          '';


        const subject =
          $('#teacherSubject')
            ?.value
            .trim() ||
          '';


        const plannedClassCount =
          Number(
            $('#teacherPlannedClasses')
              ?.value ||
            0
          );


        const plannedStudentCount =
          Number(
            $('#teacherPlannedStudents')
              ?.value ||
            0
          );


        const phone =
          $('#teacherPhone')
            ?.value
            .trim() ||
          '';


        const usePurpose =
          $('#teacherPurpose')
            ?.value
            .trim() ||
          '';


        if (!displayName) {

          throw new Error(
            '先生の名前を入力してください。'
          );
        }


        if (
          !schoolName ||
          !prefecture ||
          !schoolType ||
          !subject
        ) {

          throw new Error(
            '学校名・都道府県・学校種別・担当を入力してください。'
          );
        }


        if (
          !Number.isInteger(
            plannedClassCount
          ) ||
          plannedClassCount < 1 ||
          plannedClassCount > 100
        ) {

          throw new Error(
            '利用予定クラス数を正しく入力してください。'
          );
        }


        if (
          !Number.isInteger(
            plannedStudentCount
          ) ||
          plannedStudentCount < 1 ||
          plannedStudentCount > 10000
        ) {

          throw new Error(
            '利用予定生徒数を正しく入力してください。'
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
                    'teacher',

                  school_name:
                    schoolName,

                  prefecture:
                    prefecture,

                  school_type:
                    schoolType,

                  subject:
                    subject,

                  planned_class_count:
                    String(
                      plannedClassCount
                    ),

                  planned_student_count:
                    String(
                      plannedStudentCount
                    ),

                  phone:
                    phone,

                  use_purpose:
                    usePurpose

                }

              }

            });


        if (error) {

          throw error;
        }


        if (data.session) {

          location.href =
            'teacher-pending.html';

        } else {

          showMessage(
            'Teacherアカウントを作成しました。確認メールが届いた場合はメール認証後にSign inしてください。その後、管理者の承認をお待ちください。',
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
// SAVED STUDENT SESSION VALIDATION
// ==========================================

async function invalidateSavedStudentSession(
  sb,
  reason = ''
) {

  if (reason) {

    console.warn(
      '[Student Saved Session]',
      reason
    );
  }


  try {

    if (sb) {

      await sb.auth
        .signOut();
    }

  } catch (error) {

    console.warn(
      '[Student Saved Session SignOut]',
      error
    );
  }


  clearStudentAuthStorage();

  rememberedStudent =
    null;
}


// ==========================================
// 保存されたStudent Sessionが
// 本当にClassroomで使えるか確認
// ==========================================

async function getValidRememberedStudent(
  sb
) {

  // ----------------------------------------
  // SESSION
  // ----------------------------------------

  const {
    data: {
      session
    },
    error: sessionError
  } =
    await sb.auth
      .getSession();


  if (sessionError) {

    console.warn(
      '[Student Saved Session]',
      sessionError
    );

    return null;
  }


  if (!session) {

    return null;
  }


  // ----------------------------------------
  // USER
  // ----------------------------------------

  const {
    data: {
      user
    },
    error: userError
  } =
    await sb.auth
      .getUser();


  if (
    userError ||
    !user
  ) {

    await invalidateSavedStudentSession(
      sb,
      'Saved user is no longer valid.'
    );

    return null;
  }


  // ----------------------------------------
  // PROFILE
  // ----------------------------------------

  const {
    data: profile,
    error: profileError
  } =
    await sb
      .from(
        'profiles'
      )
      .select(
        'display_name, role'
      )
      .eq(
        'id',
        user.id
      )
      .maybeSingle();


  if (profileError) {

    console.warn(
      '[Student Saved Profile]',
      profileError
    );

    return null;
  }


  if (
    !profile ||
    profile.role !==
      'student'
  ) {

    await invalidateSavedStudentSession(
      sb,
      'Saved session is not a valid student profile.'
    );

    return null;
  }


  // ----------------------------------------
  // CLASS MEMBERSHIP
  //
  // ここが今回の重要な修正
  // ----------------------------------------

  const {
    data: members,
    error: memberError
  } =
    await sb
      .from(
        'class_members'
      )
      .select(
        'class_id'
      )
      .eq(
        'student_id',
        user.id
      )
      .limit(
        1
      );


  if (memberError) {

    console.warn(
      '[Student Saved Membership]',
      memberError
    );

    return null;
  }


  // 古い匿名Sessionだけ残っていて
  // Classにはもう所属していない
  if (
    !members ||
    members.length ===
      0
  ) {

    await invalidateSavedStudentSession(
      sb,
      'Saved student has no active class membership.'
    );

    return null;
  }


  return {
    user,
    profile
  };
}

// ==========================================
// INITIAL
// ==========================================

async function initializeAuthPage() {

  const authPanel =
    $('#authFormPanel');


  try {

    // ----------------------------------------
    // Remember設定
    // ----------------------------------------

    const rememberCheckbox =
      $('#studentRememberLogin');


    if (rememberCheckbox) {

      rememberCheckbox.checked =
        getStudentRememberLogin();
    }


    rememberedStudent =
      null;


    // ----------------------------------------
    // 保存Student Sessionを確認
    // ----------------------------------------

    if (isConfigured()) {

      const sb =
        getClient(
          'student'
        );


      if (sb) {

        const savedStudent =
          await getValidRememberedStudent(
            sb
          );


        if (savedStudent) {

          rememberedStudent =
            savedStudent;


          const {
            user,
            profile
          } =
            savedStudent;


          const name =
            profile.display_name ||
            user.user_metadata
              ?.display_name ||
            'Student';


          const nameElement =
            $('#rememberedStudentName');


          if (nameElement) {

            nameElement.textContent =
              name;
          }
        }
      }
    }


    // ----------------------------------------
    // ValidなStudentだけWelcome Back
    // それ以外は通常Login
    // ----------------------------------------

    showStudent();


  } catch (error) {

    console.warn(
      '[Auth Initialize]',
      error
    );


    rememberedStudent =
      null;


    showStudent();


  } finally {

    // Session確認前のちらつきを防止
    if (authPanel) {

      authPanel.style.visibility =
        'visible';
    }
  }
}
// ==========================================
// REMEMBERED STUDENT ACTIONS
// ==========================================

$('#rememberedStudentContinue')
  ?.addEventListener(
    'click',
    async () => {

      const button =
        $('#rememberedStudentContinue');


      const sb =
        getClient(
          'student'
        );


      if (!sb) {

        showMessage(
          'Student sessionを確認できませんでした。',
          'error'
        );

        return;
      }


      button.disabled =
        true;


      const originalText =
        button.textContent;


      button.textContent =
        'Checking...';


      try {

        const validStudent =
          await getValidRememberedStudent(
            sb
          );


        // ====================================
        // 古いSessionならLogin画面へ戻す
        // ====================================

        if (!validStudent) {

          rememberedStudent =
            null;


          showStudent();


          showMessage(
            '保存されていたログイン情報が古くなっています。Class Code・出席番号・Join PINで、もう一度ログインしてください。',
            'info'
          );


          return;
        }


        // ====================================
        // 正常なStudentだけClassroomへ
        // ====================================

        location.href =
          'student.html';


      } catch (error) {

        console.error(
          '[Student Continue]',
          error
        );


        rememberedStudent =
          null;


        showStudent();


        showMessage(
          'ログイン状態を確認できませんでした。もう一度ログインしてください。',
          'error'
        );


      } finally {

        button.disabled =
          false;


        button.textContent =
          originalText;
      }
    }
  );


$('#rememberedStudentSwitch')
  ?.addEventListener(
    'click',
    async () => {

      const sb =
        getClient(
          'student'
        );


      try {

        if (sb) {

          await sb.auth
            .signOut();
        }

      } catch (error) {

        console.warn(
          '[Student Switch Account]',
          error
        );
      }


      clearStudentAuthStorage();

      rememberedStudent =
        null;

      showStudent();
    }
  );

initializeAuthPage();