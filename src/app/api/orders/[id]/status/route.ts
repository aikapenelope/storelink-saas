import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { revalidatePath } from 'next/cache';
import type { Order } from '@/payload-types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: request.headers });

    if (!user) {
      return NextResponse.json({ error: 'No autorizado. Debes iniciar sesión.' }, { status: 401 });
    }

    const body = await request.json();
    const { status, paymentStatus } = body;

    // Whitelist de estados (evita valores arbitrarios que rompen los selects
    // del dashboard y el flujo de reposición de inventario del hook).
    // 'ready' se conserva por compatibilidad con pedidos legacy.
    const ALLOWED_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'in_delivery', 'delivered', 'cancelled'];
    const ALLOWED_PAYMENT_STATUSES = ['pending_verification', 'verified', 'rejected'];

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Estado inválido: ${status}` }, { status: 400 });
    }
    if (paymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
      return NextResponse.json({ error: `Estado de pago inválido: ${paymentStatus}` }, { status: 400 });
    }

    // Autorización multi-tenant 100% nativa (docs/access-control + plugin
    // multi-tenant): con overrideAccess:false + user, read/update devuelven el
    // constraint { tenant: { in: [...] } } y Payload lo combina con la query.
    // Un pedido de otra tienda o huérfano (tenant vacío) no coincide → NotFound
    // (404). El super-admin pasa vía userHasAccessToAllTenants del plugin.
    let order;
    try {
      order = await payload.findByID({
        collection: 'orders',
        id,
        user,
        overrideAccess: false,
      });
    } catch (error) {
      if ((error as { status?: number }).status === 404 || (error as Error).name === 'NotFound') {
        return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
      }
      throw error;
    }

    const updateData: {
      status?: Order['status'];
      paymentDetails?: Order['paymentDetails'];
    } = {};
    if (status) {
      updateData.status = status;
    }
    if (paymentStatus) {
      updateData.paymentDetails = {
        ...(order.paymentDetails || {}),
        paymentStatus,
      };
    }

    try {
      const updated = await payload.update({
        collection: 'orders',
        id,
        data: updateData,
        user,
        overrideAccess: false,
      });

      try {
        revalidatePath('/admin/analytics');
        revalidatePath('/admin/collections/orders');
      } catch {}

      return NextResponse.json({
        success: true,
        order: updated,
        message: 'Estado del pedido actualizado correctamente',
      });
    } catch (error) {
      if ((error as { status?: number }).status === 404 || (error as Error).name === 'NotFound') {
        return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Error interno al actualizar el pedido' }, { status: 500 });
  }
}
