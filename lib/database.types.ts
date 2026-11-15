type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<{
        user_id: string;
        role: string;
      }>;
      products: Table<{
        id: number;
        title: string;
        category: string;
        price: number;
        description: string;
        amazon_url: string | null;
        image_url: string | null;
        back_image_url: string | null;
        gallery_images: string[] | null;
        active: boolean;
        updated_at: string;
      }>;
      orders: Table<{
        id: number;
        status: string;
        fulfillment_status: string | null;
        customer_email: string | null;
        customer_name: string | null;
        phone: string | null;
        shipping_name: string | null;
        shipping_address: Record<string, unknown> | string | null;
        amount_total: number;
        currency: string | null;
        created_at: string;
        paid_at: string | null;
        fulfilled_at: string | null;
        shipping_carrier: string | null;
        tracking_number: string | null;
        items: { title?: string; quantity?: number }[] | null;
        updated_at: string;
      }>;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
