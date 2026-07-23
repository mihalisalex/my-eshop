import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductForm } from "@/components/admin/ProductForm";
import { updateProduct, deleteProduct } from "@/app/admin/(dashboard)/products/actions";
import { productToFormValues } from "@/lib/validation/product";
import { getProductById } from "@/services/products";
import { getAllCollections } from "@/services/collections";

interface AdminProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductDetailPage({ params }: AdminProductDetailPageProps) {
  const { id } = await params;
  const [product, collections] = await Promise.all([getProductById(id), getAllCollections()]);
  if (!product) notFound();

  const boundUpdate = updateProduct.bind(null, id);
  const boundDelete = deleteProduct.bind(null, id);

  return (
    <div>
      <AdminPageHeader
        title={product.name}
        description={`SKU ${product.sku} · ${product.category}`}
        actions={
          <form action={boundDelete}>
            <button
              type="submit"
              className="h-9 border border-destructive px-4 text-xs font-medium tracking-[0.05em] text-destructive uppercase"
            >
              Delete Product
            </button>
          </form>
        }
      />
      <ProductForm
        defaultValues={productToFormValues(product)}
        collections={collections.map((c) => ({ id: c.id, title: c.title }))}
        onSubmit={boundUpdate}
        submitLabel="Save Changes"
      />
    </div>
  );
}
