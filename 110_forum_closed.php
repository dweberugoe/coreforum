<?php

class ForumClosed extends Migration
{
    function description()
    {
        return 'close thread functionality for the new forum';
    }

    function up()
    {
        DBManager::get()->exec("ALTER TABLE `forum_entries` ADD `closed` TINYINT( 1 ) NOT NULL DEFAULT '0'");

        
    }

}
