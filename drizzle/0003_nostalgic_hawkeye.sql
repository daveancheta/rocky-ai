CREATE TABLE "rocky_main_person_images" (
	"memory_id" uuid PRIMARY KEY NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"image_base64" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rocky_main_person_images" ADD CONSTRAINT "rocky_main_person_images_memory_id_rocky_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."rocky_memories"("id") ON DELETE cascade ON UPDATE no action;