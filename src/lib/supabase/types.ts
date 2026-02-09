export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          thumbnail_url: string | null;
          tags: string[];
          is_public: boolean;
          presentations: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          thumbnail_url?: string | null;
          tags?: string[];
          is_public?: boolean;
          presentations?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          thumbnail_url?: string | null;
          tags?: string[];
          is_public?: boolean;
          presentations?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      public_presentations: {
        Row: {
          id: string;
          project_id: string;
          presentation_id: string;
          slug: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          presentation_id: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          presentation_id?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      canvases: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          canvas_data: Json;
          original_canvas: Json | null;
          view_mode: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          canvas_data?: Json;
          original_canvas?: Json | null;
          view_mode?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          canvas_data?: Json;
          original_canvas?: Json | null;
          view_mode?: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      node_documentation: {
        Row: {
          id: string;
          canvas_id: string;
          node_id: string;
          title: string;
          content: string | null;
          view_mode: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          canvas_id: string;
          node_id: string;
          title: string;
          content?: string | null;
          view_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          canvas_id?: string;
          node_id?: string;
          title?: string;
          content?: string | null;
          view_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
