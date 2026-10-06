import {
  getClient,
  isConfigured
} from './supabase.js';


const $ =
  selector =>
    document.querySelector(selector);


let sb = null;
let user = null;
let tickets = [];
let activeTicketId = null;


function esc(value) {

  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function formatDate(value) {

  if (!value) {
    return '—';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return '—';
  }


  return new Intl.DateTimeFormat(
    'ja-JP',
    {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(date);
}


function categoryLabel(value) {

  const labels = {

    login:
      'ログイン・アカウント',

    student:
      '生徒登録',

    assignment:
      '課題',

    microphone:
      'マイク・音声認識',

    bug:
      '不具合',

    other:
      'その他'

  };


  return (
    labels[value] ||
    'その他'
  );
}


function statusLabel(value) {

  const labels = {

    open:
      'Open',

    waiting_teacher:
      'Waiting',

    resolved:
      'Resolved'

  };


  return (
    labels[value] ||
    'Open'
  );
}


function showAlert(
  message,
  type = 'info'
) {

  const root =
    $('#supportAlert');


  if (!root) {
    return;
  }


  root.textContent =
    message;

  root.className =
    `alert ${type}`;

  root.classList.remove(
    'hidden'
  );
}


function hideAlert() {

  $('#supportAlert')
    ?.classList
    .add('hidden');
}


async function requireTeacher() {

  if (!isConfigured()) {

    location.href =
      'index.html';

    return false;
  }


  sb =
    getClient('teacher');


  if (!sb) {

    location.href =
      'index.html';

    return false;
  }


  const {
    data: {
      user: authUser
    },
    error: userError
  } =
    await sb.auth
      .getUser();


  if (
    userError ||
    !authUser
  ) {

    location.href =
      'index.html';

    return false;
  }


  user =
    authUser;


  const {
    data: profile,
    error: profileError
  } =
    await sb
      .from('profiles')
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
    profile.role !== 'teacher'
  ) {

    await sb.auth
      .signOut();


    location.href =
      'index.html';

    return false;
  }


  $('#supportUserName')
    .textContent =
      profile.display_name ||
      user.email ||
      'Teacher';


  if (
    profile.teacher_status !==
    'approved'
  ) {

    const back =
      $('#supportBack');


    if (back) {

      back.href =
        'teacher-pending.html';

      back.textContent =
        '← Approval Status';
    }
  }


  return true;
}


async function loadTickets() {

  hideAlert();


  const {
    data,
    error
  } =
    await sb
      .from('support_tickets')
      .select(
        'id,subject,category,status,created_at,last_message_at'
      )
      .eq(
        'teacher_id',
        user.id
      )
      .order(
        'last_message_at',
        {
          ascending: false
        }
      );


  if (error) {
    throw error;
  }


  tickets =
    Array.isArray(data)
      ? data
      : [];


  renderTickets();


  if (
    activeTicketId &&
    !tickets.some(
      ticket =>
        ticket.id ===
        activeTicketId
    )
  ) {

    activeTicketId =
      null;
  }
}


function renderTickets() {

  const root =
    $('#supportTicketList');


  if (!root) {
    return;
  }


  if (
    tickets.length === 0
  ) {

    root.innerHTML = `
      <div class="support-empty">
        まだ問い合わせはありません。
      </div>
    `;

    return;
  }


  root.innerHTML =
    tickets
      .map(
        ticket => `

          <button
            type="button"
            class="
              support-ticket
              ${
                ticket.id === activeTicketId
                  ? 'active'
                  : ''
              }
            "
            data-ticket-id="${esc(
              ticket.id
            )}">

            <div class="support-ticket-top">

              <span
                class="
                  support-status
                  ${esc(ticket.status)}
                ">

                ${esc(
                  statusLabel(
                    ticket.status
                  )
                )}

              </span>


              <small>

                ${esc(
                  formatDate(
                    ticket.last_message_at
                  )
                )}

              </small>

            </div>


            <strong>

              ${esc(
                ticket.subject
              )}

            </strong>


            <span class="support-ticket-category">

              ${esc(
                categoryLabel(
                  ticket.category
                )
              )}

            </span>

          </button>
        `
      )
      .join('');
}


async function loadMessages() {

  if (!activeTicketId) {
    return;
  }


  const {
    data,
    error
  } =
    await sb
      .from('support_messages')
      .select(
        'id,sender_id,body,created_at'
      )
      .eq(
        'ticket_id',
        activeTicketId
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );


  if (error) {
    throw error;
  }


  const root =
    $('#supportMessages');


  if (!root) {
    return;
  }


  root.innerHTML =
    (data || [])
      .map(
        message => {

          const mine =
            message.sender_id ===
            user.id;


          return `

            <div
              class="
                support-message
                ${mine ? 'mine' : 'admin'}
              ">

              <div class="support-message-author">

                ${
                  mine
                    ? 'You'
                    : 'Copeak Admin'
                }

              </div>


              <div class="support-message-body">

                ${esc(
                  message.body
                )}

              </div>


              <small>

                ${esc(
                  formatDate(
                    message.created_at
                  )
                )}

              </small>

            </div>
          `;
        }
      )
      .join('');


  root.scrollTop =
    root.scrollHeight;
}


async function openTicket(
  ticketId
) {

  activeTicketId =
    ticketId;


  renderTickets();


  const ticket =
    tickets.find(
      item =>
        item.id ===
        ticketId
    );


  if (!ticket) {
    return;
  }


  $('#supportNoTicket')
    ?.classList
    .add('hidden');


  $('#supportThread')
    ?.classList
    .remove('hidden');


  $('#supportTicketSubject')
    .textContent =
      ticket.subject;


  $('#supportTicketMeta')
    .textContent =
      `${categoryLabel(
        ticket.category
      )} ・ ${formatDate(
        ticket.created_at
      )}`;


  const status =
    $('#supportTicketStatus');


  status.className =
    `support-status ${ticket.status}`;


  status.textContent =
    statusLabel(
      ticket.status
    );


  await loadMessages();
}


async function createTicket(
  subject,
  category,
  body
) {

  const {
    data,
    error
  } =
    await sb.rpc(
      'create_support_ticket',
      {
        p_subject: subject,
        p_category: category,
        p_body: body
      }
    );


  if (error) {
    throw error;
  }


  await loadTickets();


  await openTicket(
    data
  );
}


async function sendMessage(
  body
) {

  if (!activeTicketId) {
    return;
  }


  const {
    error
  } =
    await sb.rpc(
      'send_support_message',
      {
        p_ticket_id:
          activeTicketId,

        p_body:
          body
      }
    );


  if (error) {
    throw error;
  }


  await loadTickets();


  await openTicket(
    activeTicketId
  );
}


$('#supportTicketList')
  ?.addEventListener(
    'click',
    async event => {

      const button =
        event.target.closest(
          '[data-ticket-id]'
        );


      if (!button) {
        return;
      }


      try {

        await openTicket(
          button.dataset.ticketId
        );

      } catch (error) {

        console.error(
          '[Support Open Ticket]',
          error
        );


        showAlert(
          error.message ||
          String(error),
          'error'
        );
      }
    }
  );


$('#newSupportTicket')
  ?.addEventListener(
    'click',
    () => {

      $('#supportModal')
        ?.classList
        .remove('hidden');


      $('#supportSubject')
        ?.focus();
    }
  );


$('#supportModalClose')
  ?.addEventListener(
    'click',
    () => {

      $('#supportModal')
        ?.classList
        .add('hidden');
    }
  );


$('#supportCreateForm')
  ?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      const subject =
        $('#supportSubject')
          .value
          .trim();


      const category =
        $('#supportCategory')
          .value;


      const body =
        $('#supportBody')
          .value
          .trim();


      if (
        !subject ||
        !body
      ) {

        return;
      }


      const button =
        $('#supportCreateButton');


      button.disabled =
        true;

      button.textContent =
        'Sending...';


      try {

        await createTicket(
          subject,
          category,
          body
        );


        event.target
          .reset();


        $('#supportModal')
          ?.classList
          .add('hidden');


        showAlert(
          '問い合わせを送信しました。',
          'ok'
        );

      } catch (error) {

        console.error(
          '[Support Create Ticket]',
          error
        );


        showAlert(
          error.message ||
          String(error),
          'error'
        );

      } finally {

        button.disabled =
          false;

        button.textContent =
          'Send Support Request';
      }
    }
  );


$('#supportReplyForm')
  ?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      const body =
        $('#supportReply')
          .value
          .trim();


      if (!body) {
        return;
      }


      const button =
        $('#supportReplyButton');


      button.disabled =
        true;

      button.textContent =
        'Sending...';


      try {

        await sendMessage(
          body
        );


        $('#supportReply')
          .value =
            '';

      } catch (error) {

        console.error(
          '[Support Reply]',
          error
        );


        showAlert(
          error.message ||
          String(error),
          'error'
        );

      } finally {

        button.disabled =
          false;

        button.textContent =
          'Send Message';
      }
    }
  );


$('#supportRefresh')
  ?.addEventListener(
    'click',
    async () => {

      try {

        await loadTickets();


        if (activeTicketId) {

          await openTicket(
            activeTicketId
          );
        }

      } catch (error) {

        showAlert(
          error.message ||
          String(error),
          'error'
        );
      }
    }
  );


$('#supportSignOut')
  ?.addEventListener(
    'click',
    async () => {

      if (sb) {

        await sb.auth
          .signOut();
      }


      location.href =
        'index.html';
    }
  );


(async () => {

  const allowed =
    await requireTeacher();


  if (!allowed) {
    return;
  }


  await loadTickets();

})()
.catch(
  error => {

    console.error(
      '[Copeak Support]',
      error
    );


    showAlert(
      error.message ||
      'Supportを読み込めませんでした。',
      'error'
    );
  }
);