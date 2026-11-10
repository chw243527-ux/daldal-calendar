CREATE TABLE `accountCloudData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`payloadJson` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accountCloudData_id` PRIMARY KEY(`id`),
	CONSTRAINT `accountCloudData_user_unique` UNIQUE(`userId`)
);
