import { describe, it, expect } from "vitest";
import { buildOrderConfirmationEmailHtml } from "@/lib/order-email";

describe("order confirmation email VES visibility (flag Devin #116)", () => {
  const baseEmailArgs = {
    storeName: "Don Luigi Pizza",
    customerName: "Carlos Pérez",
    orderNumber: "DL-1001",
    deliveryType: "delivery",
    paymentLabel: "Pago Móvil VES",
    items: [
      {
        sku: "PIZZA-PEP",
        title: "Pizza Pepperoni",
        quantity: 1,
        price: 15.0,
      },
    ],
    total: 15.0,
    totalVES: 15.0 * 50.0,
    exchangeRateVES: 50.0,
  };

  it("omite bolívares en el HTML cuando showVES es false (opt-out del comprador)", () => {
    const html = buildOrderConfirmationEmailHtml({
      ...baseEmailArgs,
      showVES: false,
    });

    expect(html).toContain("Total: $15.00 USD");
    expect(html).not.toContain("Equivalente VES");
    expect(html).not.toContain("Bs.");
  });

  it("incluye bolívares en el HTML cuando showVES es true y hay tasa VES", () => {
    const html = buildOrderConfirmationEmailHtml({
      ...baseEmailArgs,
      showVES: true,
    });

    expect(html).toContain("Total: $15.00 USD");
    expect(html).toContain("Equivalente VES");
    expect(html).toContain("Bs.");
    expect(html).toContain("Tasa: 50.00 Bs/$");
  });

  it("resuelve showVES correctamente según la regla desacoplada de order-created", () => {
    const resolveShowVES = (
      exchangeRateVES: number,
      customerShowVES?: boolean
    ): boolean => {
      const rate = Number(exchangeRateVES) || 0;
      return customerShowVES !== undefined ? customerShowVES && rate > 0 : rate > 0;
    };

    // Caso 1: Tenant tiene VES activo, pero comprador optó por no verlo (showVES: false)
    expect(resolveShowVES(50.0, false)).toBe(false);

    // Caso 2: Tenant tiene VES activo y comprador lo aceptó (showVES: true)
    expect(resolveShowVES(50.0, true)).toBe(true);

    // Caso 3: Reconciliación asíncrona sin flag de cliente (customerShowVES: undefined) -> usa tenant rate
    expect(resolveShowVES(50.0, undefined)).toBe(true);

    // Caso 4: Tenant NO tiene VES (tasa 0) -> nunca muestra Bs
    expect(resolveShowVES(0, true)).toBe(false);
    expect(resolveShowVES(0, false)).toBe(false);
    expect(resolveShowVES(0, undefined)).toBe(false);
  });
});
