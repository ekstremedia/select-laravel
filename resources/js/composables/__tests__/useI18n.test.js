describe('useI18n', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.resetModules();
    });

    async function loadUseI18n() {
        const mod = await import('../useI18n.js');
        return mod.useI18n;
    }

    it('returns Norwegian translation by default', async () => {
        const useI18n = await loadUseI18n();
        const { t } = useI18n();

        expect(t('hero.title')).toBe('SELECT');
        expect(t('hero.subtitle')).toBe('Det klassiske akronym-spillet');
    });

    it('returns the key if translation is missing', async () => {
        const useI18n = await loadUseI18n();
        const { t } = useI18n();

        expect(t('nonexistent.key')).toBe('nonexistent.key');
        expect(t('totally.made.up')).toBe('totally.made.up');
    });

    it('toggleLocale switches between NO and EN', async () => {
        const useI18n = await loadUseI18n();
        const { t, toggleLocale, locale } = useI18n();

        expect(locale.value).toBe('no');
        expect(t('cta.play')).toBe('Spill nå');

        toggleLocale();

        expect(locale.value).toBe('en');
        expect(t('cta.play')).toBe('Play now');

        toggleLocale();

        expect(locale.value).toBe('no');
        expect(t('cta.play')).toBe('Spill nå');
    });

    it('isNorwegian reflects current locale', async () => {
        const useI18n = await loadUseI18n();
        const { isNorwegian, toggleLocale } = useI18n();

        expect(isNorwegian.value).toBe(true);

        toggleLocale();
        expect(isNorwegian.value).toBe(false);

        toggleLocale();
        expect(isNorwegian.value).toBe(true);
    });

    it('persists locale to localStorage on toggle', async () => {
        const useI18n = await loadUseI18n();
        const { toggleLocale } = useI18n();

        expect(localStorage.getItem('select-locale')).toBeNull();

        toggleLocale();
        expect(localStorage.getItem('select-locale')).toBe('en');

        toggleLocale();
        expect(localStorage.getItem('select-locale')).toBe('no');
    });

    it('restores locale from localStorage', async () => {
        localStorage.setItem('select-locale', 'en');

        const useI18n = await loadUseI18n();
        const { locale, t, isNorwegian } = useI18n();

        expect(locale.value).toBe('en');
        expect(isNorwegian.value).toBe(false);
        expect(t('cta.play')).toBe('Play now');
    });

    describe('game event translations', () => {
        it('returns Norwegian translations for game events', async () => {
            const useI18n = await loadUseI18n();
            const { t } = useI18n();

            expect(t('game.playerJoined')).toBe('ble med');
            expect(t('game.playerLeft')).toBe('forlot spillet');
            expect(t('game.nicknameChanged')).toBe('skiftet navn til');
            expect(t('game.chatEnabled')).toBe('aktiverte chat');
            expect(t('game.chatDisabled')).toBe('deaktiverte chat');
            expect(t('game.visibilityPublic')).toBe('gjorde spillet offentlig');
            expect(t('game.visibilityPrivate')).toBe('gjorde spillet privat');
            expect(t('game.passwordChanged')).toBe('endret passordet');
            expect(t('game.passwordChangedTo')).toBe('satte passordet til:');
        });

        it('returns English translations for game events', async () => {
            localStorage.setItem('select-locale', 'en');

            const useI18n = await loadUseI18n();
            const { t } = useI18n();

            expect(t('game.playerJoined')).toBe('joined');
            expect(t('game.playerLeft')).toBe('left the game');
            expect(t('game.nicknameChanged')).toBe('is now known as');
            expect(t('game.chatEnabled')).toBe('enabled chat');
            expect(t('game.chatDisabled')).toBe('disabled chat');
            expect(t('game.visibilityPublic')).toBe('made the game public');
            expect(t('game.visibilityPrivate')).toBe('made the game private');
            expect(t('game.passwordChanged')).toBe('changed the password');
            expect(t('game.passwordChangedTo')).toBe('set the password to:');
        });

        it('returns Norwegian translations for password actions', async () => {
            const useI18n = await loadUseI18n();
            const { t } = useI18n();

            expect(t('game.setPassword')).toBe('Sett passord');
            expect(t('game.changePassword')).toBe('Endre passord');
            expect(t('game.passwordMinLength')).toBe('Minst 4 tegn');
        });

        it('returns English translations for password actions', async () => {
            localStorage.setItem('select-locale', 'en');

            const useI18n = await loadUseI18n();
            const { t } = useI18n();

            expect(t('game.setPassword')).toBe('Set password');
            expect(t('game.changePassword')).toBe('Change password');
            expect(t('game.passwordMinLength')).toBe('At least 4 characters');
        });

        it('translates lobby.noPlayers in both locales', async () => {
            const useI18n = await loadUseI18n();
            const { t, toggleLocale } = useI18n();

            expect(t('lobby.noPlayers')).toBe('Ingen spillere ennå');

            toggleLocale();

            expect(t('lobby.noPlayers')).toBe('No players yet');
        });
    });
});
