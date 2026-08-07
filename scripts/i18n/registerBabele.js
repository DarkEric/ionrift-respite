/**
 * Register Respite Russian Babele pack translations when Babele loads.
 */
Hooks.once("babele.init", (babele) => {
    babele.register({
        module: "ionrift-respite",
        lang: "ru",
        dir: "babele/ru"
    });
});
