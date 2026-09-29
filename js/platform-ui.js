// ==========================================
// Copeak Classroom
// Platform Navigation
// ==========================================

const navButtons =
  document.querySelectorAll(
    '[data-platform-target]'
  );


let currentPage =
  sessionStorage.getItem(
    'copeak-classroom-platform-page'
  ) || 'overview';


// ==========================================
// VISIBILITY
// ==========================================

function applyPlatformVisibility(
  pageName
) {

  const pages =
    document.querySelectorAll(
      '[data-platform-page]'
    );


  pages.forEach(
    page => {

      const active =
        page.dataset.platformPage ===
        pageName;

      page.classList.toggle(
        'platform-page-hidden',
        !active
      );
    }
  );


  navButtons.forEach(
    button => {

      const active =
        button.dataset.platformTarget ===
        pageName;

      button.classList.toggle(
        'active',
        active
      );

      if (active) {

        button.setAttribute(
          'aria-current',
          'page'
        );

      } else {

        button.removeAttribute(
          'aria-current'
        );
      }
    }
  );
}


// ==========================================
// PAGE CHANGE
// ==========================================

function showPlatformPage(
  pageName,
  scroll = true
) {

  const targetExists =
    document.querySelector(
      `[data-platform-page="${pageName}"]`
    );


  if (!targetExists) {

    pageName =
      'overview';
  }


  currentPage =
    pageName;


  sessionStorage.setItem(
    'copeak-classroom-platform-page',
    pageName
  );


  applyPlatformVisibility(
    pageName
  );


  if (scroll) {

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}


// ==========================================
// SIDEBAR
// ==========================================

navButtons.forEach(
  button => {

    button.addEventListener(
      'click',
      () => {

        showPlatformPage(
          button.dataset.platformTarget
        );
      }
    );
  }
);


// ==========================================
// QUICK ACTIONS
// ==========================================

document.addEventListener(
  'click',
  event => {

    const trigger =
      event.target.closest(
        '[data-platform-open]'
      );


    if (!trigger) {
      return;
    }


    const target =
      trigger.dataset.platformOpen;


    if (!target) {
      return;
    }


    showPlatformPage(
      target
    );
  }
);


// ==========================================
// DYNAMIC CONTENT
//
// class-manager.jsなどがあとから
// sectionを追加しても現在ページを維持
// ==========================================

const mainApp =
  document.querySelector(
    '#mainApp'
  );


if (mainApp) {

  const observer =
    new MutationObserver(
      () => {

        applyPlatformVisibility(
          currentPage
        );
      }
    );


  observer.observe(
    mainApp,
    {
      childList: true
    }
  );
}


// ==========================================
// INITIAL
// ==========================================

showPlatformPage(
  currentPage,
  false
);