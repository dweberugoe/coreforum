<?php

class ForumSticky extends Migration
{
    function description()
    {
        return 'sticky thread functionality for the new forum';
    }

    function up()
    {
        DBManager::get()->exec("ALTER TABLE `forum_entries` ADD `sticky` TINYINT( 1 ) NOT NULL DEFAULT '0'");

        
    }

}
