// Configuración global y Feature Flags de la aplicación
export const appConfig = {
  features: {
    /**
     * Portafolio multi-activo para Hogar Compartido (CEDEARs, Acciones, Bonos, Cripto).
     * Por ahora desactivado (false): el hogar opera con el Fondo Común de Inversión (FCI) de ahorro de remanentes.
     * Al activarse (true), habilita la gestión completa de cartera con cotizaciones en tiempo real para la pareja.
     */
    enableSharedInvestmentsPortfolio: false,
  },
};
