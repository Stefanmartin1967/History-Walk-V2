// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showGitHubUploadModal } from '../src/admin.js';

// Mocks
vi.mock('../src/github-sync.js', () => ({
    getStoredToken: vi.fn(() => 'fake-token'),
    saveToken: vi.fn(),
    uploadFileToGitHub: vi.fn()
}));

// We need to mock document elements since we are testing DOM interactions
describe('Admin Upload Security', () => {
    let overlay, title, message, actions;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="custom-modal-overlay"></div>
            <div id="custom-modal-title"></div>
            <div id="custom-modal-message"></div>
            <div id="custom-modal-actions"></div>
        `;
        overlay = document.getElementById('custom-modal-overlay');
        title = document.getElementById('custom-modal-title');
        message = document.getElementById('custom-modal-message');
        actions = document.getElementById('custom-modal-actions');

        // Mock confirm
        window.confirm = vi.fn(() => true);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('should open modal and have correct elements', () => {
        showGitHubUploadModal();
        expect(overlay.classList.contains('active')).toBe(true);
        expect(title.textContent).toBe("Mise en ligne GitHub");
        expect(message.querySelector('#gh-token')).toBeTruthy();
        expect(message.querySelector('#gh-file-input')).toBeTruthy();
    });

    // Since the actual file selection and click handler are inside the function scope and bound to DOM elements created inside,
    // we need to simulate the user interaction flow.

    it('should allow .gpx files without confirmation', async () => {
        showGitHubUploadModal();
        const sendBtn = actions.querySelector('.custom-modal-btn.primary');
        const fileInput = message.querySelector('#gh-file-input');

        // Simulate file selection
        const file = new File(['<gpx></gpx>'], 'test.gpx', { type: 'application/gpx+xml' });
        Object.defineProperty(fileInput, 'files', {
            value: [file]
        });

        // Mock uploadFileToGitHub inside the module - we already did
        const { uploadFileToGitHub } = await import('../src/github-sync.js');
        window.confirm.mockClear();

        await sendBtn.click();

        expect(window.confirm).not.toHaveBeenCalled();
        expect(uploadFileToGitHub).toHaveBeenCalled();
    });

    it('should allow .json files without confirmation', async () => {
        showGitHubUploadModal();
        const sendBtn = actions.querySelector('.custom-modal-btn.primary');
        const fileInput = message.querySelector('#gh-file-input');

        const file = new File(['{}'], 'data.json', { type: 'application/json' });
        Object.defineProperty(fileInput, 'files', { value: [file] });

        const { uploadFileToGitHub } = await import('../src/github-sync.js');
        window.confirm.mockClear();

        await sendBtn.click();

        expect(window.confirm).not.toHaveBeenCalled();
        expect(uploadFileToGitHub).toHaveBeenCalled();
    });

    it('should ask for confirmation for .html files', async () => {
        showGitHubUploadModal();
        const sendBtn = actions.querySelector('.custom-modal-btn.primary');
        const fileInput = message.querySelector('#gh-file-input');

        const file = new File(['<html></html>'], 'malicious.html', { type: 'text/html' });
        Object.defineProperty(fileInput, 'files', { value: [file] });

        const { uploadFileToGitHub } = await import('../src/github-sync.js');

        // Default confirm mock returns true, so it should proceed after warning
        await sendBtn.click();

        expect(window.confirm).toHaveBeenCalled();
        // Since confirmed, upload should happen
        expect(uploadFileToGitHub).toHaveBeenCalled();
    });

    it('should abort upload if confirmation is rejected for unsafe files', async () => {
        showGitHubUploadModal();
        const sendBtn = actions.querySelector('.custom-modal-btn.primary');
        const fileInput = message.querySelector('#gh-file-input');
        const statusDiv = message.querySelector('#gh-status');

        const file = new File(['<html></html>'], 'malicious.html', { type: 'text/html' });
        Object.defineProperty(fileInput, 'files', { value: [file] });

        const { uploadFileToGitHub } = await import('../src/github-sync.js');

        // Mock confirm to return false (user says NO)
        window.confirm.mockImplementation(() => false);

        await sendBtn.click();

        expect(window.confirm).toHaveBeenCalled();
        expect(uploadFileToGitHub).not.toHaveBeenCalled();
        expect(statusDiv.textContent).toContain("Upload annulé");
    });
});
