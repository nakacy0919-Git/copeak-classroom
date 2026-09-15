const $ =
  selector =>
    document.querySelector(selector);


function setButtonStyle(
  button,
  variant = 'primary'
) {

  button.className =
    `btn btn-${variant}`;
}


export function closeAppModal() {

  $('#appModal')
    ?.classList
    .add('hidden');
}


export function showConfirmModal({
  badge = 'Confirm',
  badgeType = 'danger',
  title = 'Confirm action',
  message = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  confirmVariant = 'danger'
}) {

  return new Promise(resolve => {

    const modal =
      $('#appModal');

    const backdrop =
      modal?.querySelector(
        '.app-modal-backdrop'
      );

    const badgeEl =
      $('#appModalBadge');

    const titleEl =
      $('#appModalTitle');

    const bodyEl =
      $('#appModalBody');

    const cancelBtn =
      $('#appModalCancel');

    const confirmBtn =
      $('#appModalConfirm');


    if (
      !modal ||
      !badgeEl ||
      !titleEl ||
      !bodyEl ||
      !cancelBtn ||
      !confirmBtn
    ) {

      resolve(
        window.confirm(
          message || title
        )
      );

      return;
    }


    badgeEl.textContent =
      badge;

    badgeEl.className =
      `app-modal-badge ${badgeType}`;

    titleEl.textContent =
      title;

    bodyEl.textContent =
      message;

    cancelBtn.textContent =
      cancelText;

    confirmBtn.textContent =
      confirmText;

    setButtonStyle(
      cancelBtn,
      'light'
    );

    setButtonStyle(
      confirmBtn,
      confirmVariant
    );

    cancelBtn.classList
      .remove('hidden');

    modal.classList
      .remove('hidden');


    let finished =
      false;


    const cleanup =
      () => {

        document.removeEventListener(
          'keydown',
          onKeyDown
        );

        cancelBtn.onclick =
          null;

        confirmBtn.onclick =
          null;

        if (backdrop) {
          backdrop.onclick =
            null;
        }
      };


    const finish =
      result => {

        if (finished) {
          return;
        }

        finished =
          true;

        cleanup();

        closeAppModal();

        resolve(result);
      };


    const onKeyDown =
      event => {

        if (
          event.key ===
          'Escape'
        ) {

          finish(false);
        }
      };


    document.addEventListener(
      'keydown',
      onKeyDown
    );


    cancelBtn.onclick =
      () =>
        finish(false);


    confirmBtn.onclick =
      () =>
        finish(true);


    if (backdrop) {

      backdrop.onclick =
        () =>
          finish(false);
    }


    setTimeout(
      () =>
        confirmBtn.focus(),
      50
    );
  });
}


export function showInfoModal({
  badge = 'Done',
  badgeType = 'info',
  title = 'Completed',
  message = '',
  confirmText = 'OK'
}) {

  return new Promise(resolve => {

    const modal =
      $('#appModal');

    const backdrop =
      modal?.querySelector(
        '.app-modal-backdrop'
      );

    const badgeEl =
      $('#appModalBadge');

    const titleEl =
      $('#appModalTitle');

    const bodyEl =
      $('#appModalBody');

    const cancelBtn =
      $('#appModalCancel');

    const confirmBtn =
      $('#appModalConfirm');


    if (
      !modal ||
      !badgeEl ||
      !titleEl ||
      !bodyEl ||
      !cancelBtn ||
      !confirmBtn
    ) {

      window.alert(
        message || title
      );

      resolve(true);

      return;
    }


    badgeEl.textContent =
      badge;

    badgeEl.className =
      `app-modal-badge ${badgeType}`;

    titleEl.textContent =
      title;

    bodyEl.textContent =
      message;

    cancelBtn.classList
      .add('hidden');

    confirmBtn.textContent =
      confirmText;

    setButtonStyle(
      confirmBtn,
      'primary'
    );

    modal.classList
      .remove('hidden');


    const finish =
      () => {

        confirmBtn.onclick =
          null;

        if (backdrop) {
          backdrop.onclick =
            null;
        }

        cancelBtn.classList
          .remove('hidden');

        closeAppModal();

        resolve(true);
      };


    confirmBtn.onclick =
      finish;


    if (backdrop) {

      backdrop.onclick =
        finish;
    }


    setTimeout(
      () =>
        confirmBtn.focus(),
      50
    );
  });
}


export function showFormModal({
  badge = 'Edit',
  badgeType = 'info',
  title = 'Edit',
  fields = [],
  confirmText = 'Save',
  cancelText = 'Cancel'
}) {

  return new Promise(resolve => {

    const modal =
      $('#appModal');

    const backdrop =
      modal?.querySelector(
        '.app-modal-backdrop'
      );

    const badgeEl =
      $('#appModalBadge');

    const titleEl =
      $('#appModalTitle');

    const bodyEl =
      $('#appModalBody');

    const cancelBtn =
      $('#appModalCancel');

    const confirmBtn =
      $('#appModalConfirm');


    if (
      !modal ||
      !badgeEl ||
      !titleEl ||
      !bodyEl ||
      !cancelBtn ||
      !confirmBtn
    ) {

      resolve(null);

      return;
    }


    badgeEl.textContent =
      badge;

    badgeEl.className =
      `app-modal-badge ${badgeType}`;

    titleEl.textContent =
      title;

    bodyEl.innerHTML =
      '';


    const form =
      document.createElement(
        'div'
      );


    form.className =
      'app-modal-form';


    const inputs =
      new Map();


    fields.forEach(
      field => {

        const wrapper =
          document.createElement(
            'div'
          );


        wrapper.className =
          'field';


        const label =
          document.createElement(
            'label'
          );


        label.textContent =
          field.label ||
          field.name;


        const input =
          document.createElement(
            'input'
          );


        input.className =
          'input';

        input.type =
          field.type ||
          'text';

        input.value =
          field.value ??
          '';

        input.placeholder =
          field.placeholder ||
          '';

        input.autocomplete =
          'off';


        wrapper.appendChild(
          label
        );

        wrapper.appendChild(
          input
        );

        form.appendChild(
          wrapper
        );


        inputs.set(
          field.name,
          {
            input,
            required:
              Boolean(
                field.required
              )
          }
        );
      }
    );


    const errorEl =
      document.createElement(
        'div'
      );


    errorEl.className =
      'app-modal-error';


    form.appendChild(
      errorEl
    );


    bodyEl.appendChild(
      form
    );


    cancelBtn.textContent =
      cancelText;

    confirmBtn.textContent =
      confirmText;

    setButtonStyle(
      cancelBtn,
      'light'
    );

    setButtonStyle(
      confirmBtn,
      'primary'
    );

    cancelBtn.classList
      .remove('hidden');

    modal.classList
      .remove('hidden');


    let finished =
      false;


    const cleanup =
      () => {

        document.removeEventListener(
          'keydown',
          onKeyDown
        );

        cancelBtn.onclick =
          null;

        confirmBtn.onclick =
          null;

        if (backdrop) {
          backdrop.onclick =
            null;
        }
      };


    const finish =
      result => {

        if (finished) {
          return;
        }

        finished =
          true;

        cleanup();

        closeAppModal();

        resolve(result);
      };


    const save =
      () => {

        const values = {};


        for (
          const [
            name,
            config
          ]
          of inputs
        ) {

          const value =
            config.input
              .value
              .trim();


          if (
            config.required &&
            !value
          ) {

            errorEl.textContent =
              'すべての必須項目を入力してください。';

            config.input
              .focus();

            return;
          }


          values[name] =
            value;
        }


        finish(values);
      };


    const onKeyDown =
      event => {

        if (
          event.key ===
          'Escape'
        ) {

          finish(null);
        }


        if (
          event.key ===
          'Enter'
        ) {

          event.preventDefault();

          save();
        }
      };


    document.addEventListener(
      'keydown',
      onKeyDown
    );


    cancelBtn.onclick =
      () =>
        finish(null);


    confirmBtn.onclick =
      save;


    if (backdrop) {

      backdrop.onclick =
        () =>
          finish(null);
    }


    const firstInput =
      inputs
        .values()
        .next()
        .value
        ?.input;


    setTimeout(
      () =>
        firstInput?.focus(),
      50
    );
  });
}