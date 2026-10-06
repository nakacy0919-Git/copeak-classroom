import {
  getClient,
  isConfigured
} from './supabase.js';


const $ =
  selector =>
    document.querySelector(
      selector
    );


function statusPresentation(
  status
) {

  if (
    status ===
    'approved'
  ) {

    return {
      label:
        'Approved',
      title:
        '承認されました',
      message:
        'Teacher Dashboardへ移動します。',
      icon:
        '✓'
    };
  }


  if (
    status ===
    'suspended'
  ) {

    return {
      label:
        'Suspended',
      title:
        '現在利用を停止しています',
      message:
        '管理者による確認が必要です。サポート機能は次の開発段階で追加します。',
      icon:
        '!'
    };
  }


  if (
    status ===
    'rejected'
  ) {

    return {
      label:
        'Not Approved',
      title:
        '現在承認されていません',
      message:
        '登録内容を管理者が確認しています。必要に応じて管理者からご連絡します。',
      icon:
        '!'
    };
  }


  return {
    label:
      'Pending',
    title:
      '登録内容を確認中です',
    message:
      '管理者による承認後にCopeak Classroomをご利用いただけます。',
    icon:
      '…'
  };
}


async function loadApprovalStatus() {

  if (!isConfigured()) {

    location.href =
      'index.html';

    return;
  }


  const sb =
    getClient(
      'teacher'
    );


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

    location.href =
      'index.html';

    return;
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
        'display_name,role,teacher_status'
      )
      .eq(
        'id',
        user.id
      )
      .single();


  if (
    profileError ||
    !profile ||
    profile.role !==
      'teacher'
  ) {

    await sb.auth
      .signOut();

    location.href =
      'index.html';

    return;
  }


  if (
    profile.teacher_status ===
      'approved'
  ) {

    location.href =
      'teacher.html';

    return;
  }


  const {
    data: details,
    error: detailError
  } =
    await sb
      .from(
        'teacher_details'
      )
      .select(
        'email,school_name'
      )
      .eq(
        'teacher_id',
        user.id
      )
      .maybeSingle();


  if (detailError) {

    console.warn(
      '[Teacher Approval Details]',
      detailError
    );
  }


  const presentation =
    statusPresentation(
      profile.teacher_status
    );


  $('#teacherPendingIcon')
    .textContent =
      presentation.icon;


  $('#teacherPendingTitle')
    .textContent =
      presentation.title;


  $('#teacherPendingMessage')
    .textContent =
      presentation.message;


  $('#pendingTeacherName')
    .textContent =
      profile.display_name ||
      '—';


  $('#pendingTeacherSchool')
    .textContent =
      details?.school_name ||
      '—';


  $('#pendingTeacherEmail')
    .textContent =
      details?.email ||
      user.email ||
      '—';


  $('#pendingTeacherStatus')
    .textContent =
      presentation.label;
}


$('#refreshTeacherApproval')
  ?.addEventListener(
    'click',
    async () => {

      const button =
        $('#refreshTeacherApproval');


      const original =
        button.textContent;


      button.disabled =
        true;

      button.textContent =
        'Checking...';


      try {

        await loadApprovalStatus();

      } finally {

        button.disabled =
          false;

        button.textContent =
          original;
      }
    }
  );


$('#teacherPendingSignOut')
  ?.addEventListener(
    'click',
    async () => {

      const sb =
        getClient(
          'teacher'
        );


      if (sb) {

        await sb.auth
          .signOut();
      }


      location.href =
        'index.html';
    }
  );


loadApprovalStatus()
  .catch(
    error => {

      console.error(
        '[Teacher Approval]',
        error
      );


      $('#teacherPendingTitle')
        .textContent =
          '承認状況を確認できませんでした';


      $('#teacherPendingMessage')
        .textContent =
          '時間をおいて、もう一度確認してください。';
    }
  );