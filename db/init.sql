CREATE TABLE teams (
    team_name text PRIMARY KEY,
    member1_name text NOT NULL,
    member2_name text NOT NULL,
    member3_name text,
    member1_id text NOT NULL,
    member2_id text NOT NULL,
    member3_id text,
    member1_dis text NOT NULL,
    member2_dis text NOT NULL,
    member3_dis text
);

CREATE TABLE submissions (
    team_name text NOT NULL REFERENCES teams(team_name),
    question integer NOT NULL,
    points integer NOT NULL,
    solved boolean NOT NULL,
    solved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_name, question)
);