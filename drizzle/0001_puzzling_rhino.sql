CREATE TABLE `familyMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spaceId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','member') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `familyMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `familyMembers_space_user_unique` UNIQUE(`spaceId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `familySpaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inviteCode` varchar(12) NOT NULL,
	`name` varchar(80) NOT NULL DEFAULT '우리 가족 가계부',
	`ownerUserId` int NOT NULL,
	`ledgerJson` text NOT NULL,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `familySpaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `familySpaces_inviteCode_unique` UNIQUE(`inviteCode`)
);
