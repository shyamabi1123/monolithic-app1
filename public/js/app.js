document.addEventListener('DOMContentLoaded', () => {

  // Auto dismiss alerts
  const alerts = document.querySelectorAll('.alert');

  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s ease';
      alert.style.opacity = '0';

      setTimeout(() => {
        if (alert.parentNode) {
          alert.remove();
        }
      }, 500);

    }, 4000);
  });

  // Confirmation dialog for delete actions
  const confirmButtons = document.querySelectorAll('[data-confirm]');

  confirmButtons.forEach(button => {
    button.addEventListener('click', (event) => {

      const message =
        button.dataset.confirm ||
        'Are you sure you want to continue?';

      if (!window.confirm(message)) {
        event.preventDefault();
      }

    });
  });

});
