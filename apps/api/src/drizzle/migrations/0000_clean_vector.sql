CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"user_id" text,
	"host" text,
	"port" integer,
	"database" text,
	"username" text,
	"password" text,
	"ssl" boolean DEFAULT false,
	"ssl_ca" text,
	"ssl_cert" text,
	"ssl_key" text,
	"account" text,
	"warehouse" text,
	"role" text,
	"protocol" text,
	"connection_string" text,
	"label" text,
	"color" text,
	"external_connection_id" text,
	"last_connected_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queries" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text,
	"sql" text NOT NULL,
	"database" text,
	"schema" text,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"duration" text,
	"row_count" text,
	"error" text,
	"is_success" boolean DEFAULT true,
	"title" text,
	"is_favorite" boolean DEFAULT false,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"category" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "queries" ADD CONSTRAINT "queries_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;