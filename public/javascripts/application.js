document.addEventListener('DOMContentLoaded', () => {
  const forms = document.querySelectorAll('form.delete, form.complete_all');
  forms.forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (confirm('Are you sure? This cannot be undone!')) {
        event.target.submit();
      }
    });
  });
});
