import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { revalidatePath } from 'next/cache';

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
    // del dashboard y el flujo de reposición de inventario del hook)
    const ALLOWED_STATUSES = ['pending', 'confirmed', 'preparing', 'in_delivery', 'delivered', 'cancelled'];
    const ALLOWED_PAYMENT_STATUSES = ['pending_verification', 'verified', 'rejected'];

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Estado inválido: ${status}` }, { status: 400 });
    }
    if (paymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(paymentStatus)) {
      return NextResponse.json({ error: `Estado de pago inválido: ${paymentStatus}` }, { status: 400 });
    }

    // Fetch existing order
    const order = await payload.findByID({
      collection: 'orders',
      id,
    });

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // Verify multi-tenant authorization
    const isSuperAdmin = (user as any).role === 'super-admin';
    const userTenants = (user as any).tenants || [];
    const orderTenantId = typeof (order as any).tenant === 'object'
      ? (order as any).tenant?.id
      : (order as any).tenant;

    const hasAccess =
      isSuperAdmin ||
      !orderTenantId ||
      userTenants.some((t: any) => {
        const tid = typeof t.tenant === 'object' ? t.tenant?.id : t.tenant;
        return tid === orderTenantId;
      });

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No tienes permiso para modificar pedidos de otra tienda.' },
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (status) {
      updateData.status = status;
    }
    if (paymentStatus) {
      updateData.paymentDetails = {
        ...(order.paymentDetails || {}),
        paymentStatus,
      };
    }

    const updated = await payload.update({
      collection: 'orders',
      id,
      data: updateData,
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
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Error interno al actualizar el pedido' }, { status: 500 });
  }
}
