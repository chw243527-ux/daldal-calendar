CREATE TABLE `familyBackups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spaceId` int NOT NULL,
	`version` int NOT NULL,
	`snapshotJson` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `familyBackups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `familySpaces` ADD `version` int DEFAULT 1 NOT NULL;