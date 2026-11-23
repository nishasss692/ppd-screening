export const BrandLogo = () => `
  <span class="brand-wordmark" style="display: inline-flex; align-items: center; vertical-align: middle;">
    <img 
      src="/assets/aanchal-brand-logo.png" 
      alt="AANCHAL — Caring for the One Who Cares for All" 
      class="aanchal-brand-logo-img" 
      style="height: 42px; width: auto; max-height: 44px; object-fit: contain; display: block;" 
      onerror="if (this.src.indexOf('aanchal-brand-logo.svg') === -1) { this.src = '/assets/aanchal-brand-logo.svg'; }"
    />
    <span class="brand-m" data-brand="aanchal" data-legacy-alias="miora" style="display: none;" aria-hidden="true"></span>
  </span>
`;
