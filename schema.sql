begin;
create table room (id uuid primary key, name varchar(256));
create table image (id uuid primary key, source text);
create table item (id uuid primary key, room_id uuid references room, image_id uuid references image, position point);
end;
