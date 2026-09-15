/* Wraps a submit handler so the form never navigates. */
export const onSubmit =
  (handle: (event: Event) => void): EventListener =>
  (event) => {
    event.preventDefault();
    handle(event);
  };
