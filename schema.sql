begin;
create table room (id uuid primary key, name varchar(256));
create table image (id varchar(256) primary key);
create table item (id uuid primary key, room_id uuid references room, image_id varchar(256) references image, position point);
insert into image (id) values ('default.gif');
end;
