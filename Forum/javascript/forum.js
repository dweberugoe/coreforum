/*global window, $, jQuery, document, _ */
/* ------------------------------------------------------------------------
 * the global STUDIP namespace
 * ------------------------------------------------------------------------ */
var STUDIP = STUDIP || {};

STUDIP.Forum = {
    confirmDialog: null,
    current_area_id: null,
    current_category_id: null,
    seminar_id: null,
    clipboard: {},

    init: function () {
        $('html').addClass('forum');

        // Fenstergr��e f�r Infobox testen
        STUDIP.Forum.checkWindowSize();
        $(window).resize(STUDIP.Forum.checkWindowSize);
        
       
        // make categories and areas sortable
        jQuery('#sortable_areas').sortable({
            axis: 'y',
            items: ">*.movable",
            handle: 'td.handle',
            stop: function () {
                var categories = {};
                categories.categories = {};
                jQuery(this).find('table').each(function () {
                    var name = jQuery(this).attr('data-category-id');
                    categories.categories[name] = name;
                });

                jQuery.ajax({
                    type: 'POST',
                    url: STUDIP.URLHelper.getURL('plugins.php/coreforum/index/savecats?cid=' + STUDIP.Forum.seminar_id),
                    data: categories
                });
            }
        });

        jQuery('tbody.sortable').sortable({
            axis: 'y',
            items: ">*:not(.sort-disabled)",
            connectWith: 'tbody.sortable',
            handle: 'img.handle',
            helper: function (e, ui) {
                ui.children().each(function () {
                    jQuery(this).width(jQuery(this).width());
                });
                return ui;
            },

            stop: function () {
                // iterate over each category and get the areas there
                var areas = {};
                areas.areas = {};
                jQuery('#sortable_areas').find('table').each(function () {
                    var category_id = jQuery(this).attr('data-category-id');

                    areas.areas[category_id] = {};

                    jQuery(this).find('tr').each(function () {
                        var area_id = jQuery(this).attr('data-area-id');
                        areas.areas[category_id][area_id] = area_id;
                    });
                });

                jQuery.ajax({
                    type: 'POST',
                    url: STUDIP.URLHelper.getURL('plugins.php/coreforum/index/saveareas?cid=' + STUDIP.Forum.seminar_id),
                    data: areas
                });
            }
        });

        // compile template
        var getTemplate = _.memoize(function(name) {
            return _.template(jQuery("#" + name).html());
        })
        
        STUDIP.Forum.confirmDialog = getTemplate('confirm_dialog');
    },

    insertSmiley: function(textarea_id, element) {
        jQuery('textarea[data-textarea=' + textarea_id + ']').insertAtCaret(jQuery(element).attr('data-smiley'));
    },
    
    approveDelete: function () {
        if (STUDIP.Forum.current_area_id) {
            // hide the area in the dom
            jQuery('tr[data-area-id=' + STUDIP.Forum.current_area_id + ']').remove();
            STUDIP.Forum.closeDialog();

            // ajax call to make the deletion permanent
            jQuery.ajax(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/delete_entry/'
                + STUDIP.Forum.current_area_id + '?cid=' + STUDIP.Forum.seminar_id), {
                success: function (html) {
                    jQuery('#message_area').html(html);
                }
            });

            STUDIP.Forum.current_area_id = null;
        }

        if (STUDIP.Forum.current_category_id) {
            // hide the table in the dom
            jQuery('table[data-category-id=' + STUDIP.Forum.current_category_id + ']').fadeOut();
            STUDIP.Forum.closeDialog();

            // move all areas to the default category
            jQuery('table[data-category-id=' + STUDIP.Forum.current_category_id + '] tr.movable').each(function () {
                jQuery('table[data-category-id=' + STUDIP.Forum.seminar_id + ']').append(jQuery(this));
            });

            // ajax call to make the deletion permanent
            jQuery.ajax(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/remove_category/'
                + STUDIP.Forum.current_category_id + '?cid=' + STUDIP.Forum.seminar_id), {
                success: function (html) {
                    jQuery('#message_area').html(html);
                }
            });

            STUDIP.Forum.current_category_id = null;
        }
    },

    checkWindowSize: function() {
        if ($(window).width() <= 400) {
            $('#layout_sidebar').css('display', 'none');
        } else {
            $('#layout_sidebar').css('display', 'block');
        }
    },
    
    deleteArea: function (element, area_id) {
        STUDIP.Forum.showDialog('Sind sie sicher, dass Sie diesen Bereich l�schen m�chten? ' 
            + 'Es werden auch alle Beitr�ge in diesem Bereich gel�scht!'.toLocaleString(),
            'javascript:STUDIP.Forum.approveDelete()',
            'tr[data-area-id=' + area_id +'] td.areaentry');

        STUDIP.Forum.current_area_id = area_id;
    },

    addArea: function (category_id) {
        this.cancelAddArea();
        jQuery('table[data-category-id=' + category_id + ']').find("tr.new_area").show();
        jQuery('table[data-category-id=' + category_id + ']').find("tr.add_area").hide();
    },

    cancelAddArea: function () {
        jQuery('tr.new_area').hide();
        jQuery('tr.add_area').show();
    },

    deleteCategory: function (category_id) {
        STUDIP.Forum.showDialog('Sind sie sicher, dass Sie diese Kategorie entfernen m�chten? ' 
            + 'Alle Bereiche werden dann nach "Allgemein" verschoben!'.toLocaleString(),
            'javascript:STUDIP.Forum.approveDelete()',
            'table[data-category-id=' + category_id +'] td.areaentry');

        STUDIP.Forum.current_category_id = category_id;
    },

    editCategoryName: function (category_id) {
        jQuery('table[data-category-id=' + category_id + '] span.heading').hide();
        jQuery('table[data-category-id=' + category_id + '] span.heading_edit').show();
    },

    cancelEditCategoryName: function (category_id) {
        jQuery('table[data-category-id=' + category_id + '] span.heading_edit').hide();
        jQuery('table[data-category-id=' + category_id + '] span.heading').show();

        // reset the input field with the unchanged name
        jQuery('table[data-category-id=' + category_id + '] span.heading_edit input[type=text]').val(
            jQuery('table[data-category-id=' + category_id + '] span.category_name').text().trim()
        ).closest('form').data('validator').reset();
    },

    saveCategoryName: function (category_id) {
        var name = {};
        name.name = jQuery('table[data-category-id=' + category_id + '] span.heading_edit input[type=text]').val();

        if (!$.trim(name.name).length) {
            jQuery('table[data-category-id=' + category_id + '] span.heading_edit input[type=text]').val('').closest('form').data('validator').checkValidity();
            return;
        }

        // display the new name immediately
        jQuery('table[data-category-id=' + category_id + '] span.category_name').text(name.name);

        jQuery('table[data-category-id=' + category_id + '] span.heading_edit').hide();
        jQuery('table[data-category-id=' + category_id + '] span.heading').show();

        jQuery.ajax(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/edit_category/' + category_id + '?cid=' + STUDIP.Forum.seminar_id), {
            type: 'POST',
            data: name
        });
    },


    editArea: function (area_id) {
        jQuery('tr[data-area-id=' + area_id + '] span.areadata').hide();
        jQuery('tr[data-area-id=' + area_id + '] span.areaname_edit').show();
        jQuery('tr[data-area-id=' + area_id + '] span.areadata').parent().css('height', 'auto');
    },

    cancelEditArea: function (area_id) {
        jQuery('tr[data-area-id=' + area_id + '] span.areaname_edit').hide();
        jQuery('tr[data-area-id=' + area_id + '] span.areadata').show();

        // reset the input field with the unchanged name
        jQuery('tr[data-area-id=' + area_id + '] span.areaname_edit input[name=name]').val(
            jQuery('tr[data-area-id=' + area_id + '] span.areaname').text().trim()
        );

        jQuery('tr[data-area-id=' + area_id + '] span.areaname_edit textarea[name=content]').val(
            jQuery('tr[data-area-id=' + area_id + '] div.areacontent').text().trim()
        );
            
            jQuery('tr[data-area-id=' + area_id + '] span.areadata').parent().css('height', '');
    },

    saveArea: function (area_id) {
        var name = {};
        name.name = jQuery('tr[data-area-id=' + area_id + '] span.areaname_edit input[type=text]').val();
        name.content = jQuery('tr[data-area-id=' + area_id + '] span.areaname_edit textarea').val();

        // display the new name immediately
        jQuery('tr[data-area-id=' + area_id + '] span.areaname').text(name.name);
        jQuery('tr[data-area-id=' + area_id + '] div.areacontent').text(name.content);

        jQuery('tr[data-area-id=' + area_id + '] span.areaname_edit').hide();
        jQuery('tr[data-area-id=' + area_id + '] span.areaname').parent().parent().show();

        jQuery.ajax(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/edit_area/' + area_id + '?cid=' + STUDIP.Forum.seminar_id), {
            type: 'POST',
            data: name
        });
    },

    saveEntry: function(topic_id) {
        jQuery('span[data-edit-topic=' + topic_id +'] input[name=name]').attr('data-reset',
            jQuery('span[data-edit-topic=' + topic_id +'] input[name=name]').val()
        );
            
        jQuery('span[data-edit-topic=' + topic_id +'] textarea[name=content]').attr('data-reset',
            jQuery('span[data-edit-topic=' + topic_id +'] textarea[name=content]').val()
        );

        jQuery.ajax(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/update_entry/' + topic_id + '?cid=' + STUDIP.Forum.seminar_id), {
            type: 'POST',
            data: jQuery('form[data-topicid='+ topic_id +']').serializeObject(),
            success: function (data) {
                var json = jQuery.parseJSON(data);
                // set the new name and content
                jQuery('span[data-topic-name=' + topic_id +']').html(json.name);
                jQuery('span[data-topic-content=' + topic_id +']').html(json.content);
                
                // hide the other stuff
                jQuery('div[id*=preview]').parent().hide();
                jQuery('span[data-edit-topic=' + topic_id +']').hide();
                jQuery('span[data-show-topic=' + topic_id +']').show();  
                
            }
        });
    },
    
    editEntry: function (topic_id) {
        jQuery('div[id*=preview]').parent().hide();
        jQuery('span[data-edit-topic*=]').hide();
        jQuery('span[data-show-topic*=]').show();
        
        jQuery('span[data-edit-topic=' + topic_id +']').show();
        jQuery('span[data-show-topic=' + topic_id +']').hide();
    },
    
    cancelEditEntry: function (topic_id) {
        jQuery('div[id*=preview]').parent().hide();

        jQuery('span[data-edit-topic=' + topic_id +'] input[name=name]').val(
            jQuery('span[data-edit-topic=' + topic_id +'] input[name=name]').attr('data-reset')
        );

        jQuery('span[data-edit-topic=' + topic_id +'] textarea[name=content]').val(
            jQuery('span[data-edit-topic=' + topic_id +'] textarea[name=content]').attr('data-reset')
        );

        jQuery('span[data-edit-topic=' + topic_id +']').hide();
        jQuery('span[data-show-topic=' + topic_id +']').show();  
    },

    newEntry: function() {
        jQuery('#new_entry_button').hide();
        jQuery('#new_entry_box').show();
        jQuery('body').animate({scrollTop: jQuery('#new_entry_box').offset().top - 40}, 'slow');
        jQuery('html').animate({scrollTop: jQuery('#new_entry_box').offset().top - 40}, 'slow');
    },

    cancelNewEntry: function() {
        jQuery('#new_entry_button').show();
        jQuery('#new_entry_box').hide();
        
        jQuery('#new_entry_box textarea, #new_entry_box input[name=name]').val('');
        jQuery('#forum_new_entry').data('validator').reset();
        
        // hide and clear preview-window (if any);
        jQuery('#new_entry_preview').parent().hide();
        jQuery('#new_entry_preview').html('');
        return false;
    },

    answerEntry: function() {
        // move the new-entry-boy to the end of the page (may be displaced by citing-attempts)
        jQuery('#new_entry_box').insertAfter('#new_entry_button');

        STUDIP.Forum.newEntry();
    },

    citeEntry: function(topic_id) {
        // hide and clear preview-window (if any);
        jQuery('#new_entry_preview').parent().hide();
        jQuery('#new_entry_preview').html('');

        var name = jQuery('span.username[data-profile=' + topic_id +']').text().trim();
        
        // add content from cited posting in [quote]-tags
        var content = '[quote=' + name + ']' + "\n"
            + jQuery('span[data-edit-topic=' + topic_id +'] textarea[name=content]').val()
            + "\n[/quote]"

        jQuery('#new_entry_box textarea').val(content);
        jQuery('#new_entry_box').insertAfter('form[data-topicid=' + topic_id + ']');
        jQuery('#new_entry_box').addClass('cite_box');
        
        jQuery('input[type=hidden][name=parent]').val(topic_id);
        STUDIP.Forum.newEntry();
    },
    
    forwardEntry: function(topic_id) {
        var title   = jQuery('span[data-edit-topic=' + topic_id +'] [name=name]').attr('value');
        var content = jQuery('span[data-edit-topic=' + topic_id +'] textarea[name=content]').val();
        var text    = 'Die Senderin/der Sender dieser Nachricht m�chte Sie auf den folgenden Beitrag aufmerksam machen. '
                    + "\n\n" + 'Link zum Beitrag: ' + "\n";
        
        STUDIP.Forum.postToUrl(STUDIP.URLHelper.getURL('sms_send.php'), {
            'message' :  text.toLocaleString()
                + STUDIP.URLHelper.getURL('plugins.php/coreforum/index/index/'
                + topic_id + '?cid=' + STUDIP.Forum.seminar_id + '&again=yes#' + topic_id)
                + "\n\n" + content + "\n\n",
            'sms_source_page' : 'plugins.php/coreforum/index/index/'
                + topic_id + '?cid=' + STUDIP.Forum.seminar_id + '#' + topic_id,
            'messagesubject': 'WG: ' + title
        });
    },

    postToUrl: function(path, params) {
        // create a form
        var form = jQuery('<form method="post" action="' + path + '" style="display: none">');
        for (var key in params) {
            jQuery(form).append('<textarea name="' + key + '">' + params[key] + '</textarea>');
        }

        // append it to the body-element
        jQuery('body').append(form);
        
        // submit it
        jQuery(form).submit();
    },

    moveThreadDialog: function (topic_id) {
        $('tr[data-area-id=' + topic_id +'] td.areaentry').addClass('selected');
        jQuery('#dialog_' + topic_id).dialog({ 
            height: 400,
            width: 400,
            beforeClose: function() {
                $('tr[data-area-id=' + topic_id +'] td.areaentry').removeClass('selected');
            }
        });
    },

    preview: function (text_element_id, preview_id) {
        var posting = {};
        posting.posting = jQuery('textarea[data-textarea=' + text_element_id + ']').val();

        jQuery.ajax(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/preview?cid=' + STUDIP.Forum.seminar_id), {
            type: 'POST',
            data: posting,
            success: function (html) {
                jQuery('#' + preview_id).html(html);
                jQuery('#' + preview_id).parent().show();
            }
        });
    },
    
    loadAction: function(element, action) {
        jQuery(element).load(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/'
            + action + '?cid=' + STUDIP.Forum.seminar_id))
    },
    
    startTour: function() {
        $('#joyRideTipContent').joyride();
    },
    
    showDialog: function(question, confirm, highlight_element) {
        if (highlight_element !== null) {
            // STUDIP.Forum.highlightedElement = highlight_element;
            jQuery(highlight_element).addClass('selected');
            console.log(highlight_element);
        }
        
        jQuery('body').append(STUDIP.Forum.confirmDialog({
            question: question,
            confirm: confirm
        }));
    },
    
    closeDialog: function() {
        jQuery('#forum td.selected').removeClass('selected');
        jQuery('div.modaloverlay').remove();
    },
    
    setFavorite: function(topic_id) {
        jQuery('#favorite_' + topic_id).load(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/set_favorite/'
            + topic_id + '?cid=' + STUDIP.Forum.seminar_id));
        jQuery('a.marked[data-topic-id=' + topic_id +']').show();
        return false;
    },
    
    unsetFavorite: function(topic_id) {
        jQuery('#favorite_' + topic_id).load(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/unset_favorite/'
            + topic_id + '?cid=' + STUDIP.Forum.seminar_id));
        jQuery('a.marked[data-topic-id=' + topic_id +']').hide();
        return false;
    },

    adminLoadChilds: function(topic_id) {
        // if there is already data present, remove it (to "close" the current node in the tree)
        if (jQuery('li[data-id=' + topic_id + '] ul').length) {
            jQuery('li[data-id=' + topic_id + '] ul').remove();
            return;
        }
        
        jQuery('li[data-id=' + topic_id + '] > a.tooltip2').showAjaxNotification();
        
        // load children from server and show them
        jQuery.ajax(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/admin_getchilds/' + topic_id), {
            dataType: 'html',
            success: function(response) {
                jQuery('li[data-id=' + topic_id + ']').append(response);

                jQuery('li[data-id=' + topic_id + '] a.tooltip2').hideAjaxNotification();

                // clean up icons
                STUDIP.Forum.checkCutPaste();
            }
        });
    },

    cut : function(topic_id) {
        // remove all childs from clipboard
        jQuery('li[data-id=' + topic_id +'] li.selected').each(function(){
            var tid = jQuery(this).attr('data-id');
            jQuery(this).removeClass('selected');
            delete STUDIP.Forum.clipboard[tid];
        });

        // add this element to clipboard and mark it as selected
        jQuery('li[data-id=' + topic_id +']').addClass('selected');
        jQuery('li[data-id=' + topic_id + '] > a[data-role=cut]').hide();
        jQuery('li[data-id=' + topic_id + '] > a[data-role=cancel_cut]').show();
        STUDIP.Forum.clipboard[topic_id] = topic_id;

        // iterate over every li and remove the paste icon from all li's in the clipboard'
        jQuery('#forum li').each(function() {
            var tid = jQuery(this).attr('data-id');
            if (tid !== null && !STUDIP.Forum.clipboard[tid]) {
                jQuery(this).find('a[data-role=paste]').show();
            } else {
                jQuery(this).find('a[data-role=paste]').hide();
            }
        });

        // clean up icons (if necessary)
        STUDIP.Forum.checkCutPaste();
    },

    cancelCut: function(topic_id) {
        // remove the selected element from the clipboard and unmark it
        jQuery('li[data-id=' + topic_id +']').removeClass('selected');
        jQuery('li[data-id=' + topic_id + '] a[data-role=cut]').show();
        jQuery('li[data-id=' + topic_id + '] > a[data-role=cancel_cut]').hide();
        
        delete STUDIP.Forum.clipboard[topic_id];

        // all children are now valid paste-targets again
        jQuery('li[data-id=' + topic_id + '] a[data-role=paste]').show();

        if (Object.keys(STUDIP.Forum.clipboard).length == 0) {
            jQuery('a[data-role=paste]').hide();
        }

        // clean up icons (if necessary)
        STUDIP.Forum.checkCutPaste();
    },

    paste: function(topic_id) {
        jQuery('li[data-id=' + topic_id + '] > a.tooltip2').showAjaxNotification();

        jQuery.ajax(STUDIP.URLHelper.getURL('plugins.php/coreforum/index/admin_move/' + topic_id), {
            data : {
                'topics' : STUDIP.Forum.clipboard
            },
            type: 'POST',
            success: function(response) {
                jQuery('li[data-id=' + topic_id + '] a.tooltip2').hideAjaxNotification();

                // remove all pasted entries, the are now elsewhere
                for (id in STUDIP.Forum.clipboard) {
                    jQuery('li[data-id=' + id + ']').remove();
                }

                // reload childs after succesful moving
                jQuery('li[data-id=' + topic_id + '] ul').remove();
                STUDIP.Forum.adminLoadChilds(topic_id);
                // reset icons after succesful moving
                STUDIP.Forum.clipboard = {};
                jQuery('a[data-role=cut]').show();
                jQuery('a[data-role=cancel_cut]').hide();
                jQuery('a[data-role=paste]').hide();
                jQuery('li.selected').removeClass('selected');                
            }
        });
    },

    checkCutPaste: function() {
        jQuery('li.selected').find('li').each(function(){
            var tid = jQuery(this).attr('data-id');
            delete STUDIP.Forum.clipboard[tid];

            jQuery(this).removeClass('selected');
            jQuery(this).find('a[data-role=cut]').hide();
            jQuery(this).find('a[data-role=cancel_cut]').hide();
            jQuery(this).find('a[data-role=paste]').hide();
        });
    }
};


// TODO: make TIC and add this to the Stud.IP-Core
/**
 * found at stackoverflow.com
 * http://stackoverflow.com/questions/946534/insert-text-into-textarea-with-jquery/946556#946556
 */
jQuery.fn.extend({
    insertAtCaret: function (myValue) {
        return this.each(function (i) {
            if (document.selection) {
                //For browsers like Internet Explorer
                this.focus();
                var sel = document.selection.createRange();
                sel.text = myValue;
                this.focus();
            } else if (this.selectionStart || this.selectionStart === '0') {
                //For browsers like Firefox and Webkit based
                var startPos = this.selectionStart;
                var endPos = this.selectionEnd;
                var scrollTop = this.scrollTop;
                this.value = this.value.substring(0, startPos) + myValue
                    + this.value.substring(endPos, this.value.length);
                this.focus();
                this.selectionStart = startPos + myValue.length;
                this.selectionEnd = startPos + myValue.length;
                this.scrollTop = scrollTop;
            } else {
                this.value += myValue;
                this.focus();
            }
        });
    }
});

/** 
 * Thanks to Tobias Cohen for this function
 * http://stackoverflow.com/questions/1184624/convert-form-data-to-js-object-with-jquery
 */
jQuery.fn.serializeObject = function() {
    var o = {};
    var a = this.serializeArray();
    jQuery.each(a, function() {
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};