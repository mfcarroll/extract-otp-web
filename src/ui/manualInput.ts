// src/ui/manualInput.ts
import { parseFlexibleInput } from '../services/otpUrlParser';
import { getOtpUniqueKey, filterAndLogOtps } from '../services/dataHandler';
import { setState, getState } from '../state/store';
import { addUploadLog } from './notifications';
import { $ } from './dom';
import { openModal, closeModal } from './modalHandler';
import { t } from '../i18n';

export function initManualInput(): void {
  const btnOpenModal = $<HTMLButtonElement>('#btn-manual-entry');
  const modal = $<HTMLDivElement>('#manual-modal');
  const inputEl = $<HTMLInputElement>('#manual-otp-input');
  const submitBtn = $<HTMLButtonElement>('#manual-otp-submit');
  const cancelBtn = $<HTMLButtonElement>('#manual-otp-cancel');
  const closeBtn = modal.querySelector<HTMLButtonElement>('.modal-close');

  const hideModal = () => {
    closeModal(modal);
    inputEl.value = ''; // Clear on close
  };

  btnOpenModal.addEventListener('click', () => {
    openModal(modal, hideModal, false);
    // Focus the text box so users can paste immediately
    setTimeout(() => inputEl.focus(), 50);
  });

  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  cancelBtn.addEventListener('click', hideModal);

  const handleManualSubmit = async () => {
    const inputValue = inputEl.value.trim();
    if (!inputValue) return;

    inputEl.disabled = true;
    submitBtn.disabled = true;

    try {
      $<HTMLDivElement>('#upload-log-container').classList.add('visible');

      const currentOtps = getState().otps;
      const existingAndBatchKeys = new Set(currentOtps.map(getOtpUniqueKey));
      const firstNewIndex = currentOtps.length;

      // Use the new flexible parser
      const otpParameters = await parseFlexibleInput(inputValue);

      if (otpParameters && otpParameters.length > 0) {
        const { newOtps } = filterAndLogOtps(
          otpParameters,
          existingAndBatchKeys,
          t('log.manualInput')
        );

        if (newOtps.length > 0) {
          setState((currentState) => ({
            otps: [...currentState.otps, ...newOtps],
          }));

          hideModal();

          setTimeout(() => {
            const firstNewCard = document.getElementById(
              `otp-card-${firstNewIndex}`
            );
            if (firstNewCard) {
              firstNewCard.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }
          }, 50);
        } else {
          hideModal(); // Hide even if duplicate, logs will show the outcome
        }
      } else {
        addUploadLog(t('log.manualInput'), 'info', t('log.noSecrets'));
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      addUploadLog(t('log.manualInput'), 'error', message);
    } finally {
      inputEl.disabled = false;
      submitBtn.disabled = false;
    }
  };

  submitBtn.addEventListener('click', handleManualSubmit);
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualSubmit();
    }
  });
}
