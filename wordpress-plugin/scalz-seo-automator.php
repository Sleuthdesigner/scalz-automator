<?php
/**
 * Plugin Name:       SEO Automator
 * Plugin URI:        https://scalz.ai
 * Description:       White-label WordPress SEO automation.
 * Version:           1.1.0
 * Author:            Scalz
 * Author URI:        https://scalz.ai
 * License:           GPL-2.0-or-later
 * Text Domain:       scalz-seo-automator
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'SCALZ_SEO_VERSION', '1.1.0' );
define( 'SCALZ_SEO_FILE',    __FILE__ );
define( 'SCALZ_SEO_DIR',     plugin_dir_path( __FILE__ ) );
define( 'SCALZ_SEO_URL',     plugin_dir_url( __FILE__ ) );

$classes = [
    'class-settings.php',
    'class-api-endpoints.php',
    'class-seo-manager.php',
    'class-content-manager.php',
    'class-blog-manager.php',
    'class-integration-manager.php',
    'class-schema-manager.php',
    'class-plugin-installer.php',
    'class-internal-linker.php',
];

foreach ( $classes as $class_file ) {
    $path = SCALZ_SEO_DIR . 'includes/' . $class_file;
    if ( file_exists( $path ) ) { require_once $path; }
}

add_action( 'plugins_loaded', function() {
    if ( class_exists( 'Scalz_Settings' ) )       { Scalz_Settings::init(); }
    if ( class_exists( 'Scalz_Api_Endpoints' ) )  { Scalz_Api_Endpoints::init(); }
} );

register_activation_hook( __FILE__, function() {
    if ( ! get_option( 'scalz_seo_api_key' ) ) {
        update_option( 'scalz_seo_api_key', wp_generate_password( 32, false ) );
    }
} );

register_deactivation_hook( __FILE__, function() {} );
