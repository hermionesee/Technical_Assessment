-- initialize db for proj
USE data;

CREATE TABLE IF NOT EXISTS data (
    postId INT,
    id INT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    body TEXT
);
